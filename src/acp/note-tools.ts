import { lstat, open, realpath, rename, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { lock } from "proper-lockfile";
import { constants } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import type { ProposedChange } from "./approval";

const queues = new Map<string, Promise<unknown>>();
export const policyPath = (path: string) => path.normalize("NFC").toLowerCase();
const MAX_BYTES = 1024 * 1024;

async function notePath(vault: string, relativePath: string, writing = false): Promise<string> {
  const parts = relativePath.split("/");
  if (isAbsolute(relativePath) || /[\\:\x00-\x1f]/.test(relativePath) ||
      parts.some((part) => !part || part.startsWith(".")) || !relativePath.toLowerCase().endsWith(".md")) {
    throw new Error("仅接受仓库内普通 Markdown 笔记的相对路径。");
  }
  if (writing && (["wiki", "inbox", "templates", "prompts", "meta", "guide", "docs", "scripts", "00 dashboards"]
    .includes(policyPath(parts[0]!)) || ["agents.md", "context.md", "readme.md"].includes(policyPath(parts.at(-1)!)))) {
    throw new Error("该目录或文件不支持直接追加，请使用原有系统或知识层事务流程。");
  }
  let path = await realpath(vault);
  for (const [index, part] of parts.entries()) {
    path = join(path, part);
    const info = await lstat(path);
    if (info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) {
      throw new Error("不允许符号链接或非普通笔记文件。");
    }
  }
  return path;
}

export async function inspectNote(vault: string, relativePath: string) {
  const path = await notePath(vault, relativePath);
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error("笔记不是普通文件或超过 1 MiB 限制。");
    const text = await file.readFile("utf8");
    if (Buffer.byteLength(text) > MAX_BYTES) throw new Error("笔记超过 1 MiB 限制。");
    return { path, text, dev: info.dev, ino: info.ino, mode: info.mode };
  } finally { await file.close(); }
}

function appendText(before: string, heading: string, text: string) {
  if (!heading.trim() || /[\r\n]/.test(heading) || !text.trim()) throw new Error("标题和追加内容不能为空。");
  const lines = before.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  let offset = 0;
  let fence: { char: string; length: number } | undefined;
  const headings: { name: string; level: number; start: number }[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/\r?\n$/, "");
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(trimmed);
    if (marker) {
      if (!fence) fence = { char: marker[1]![0]!, length: marker[1]!.length };
      else if (marker[1]![0] === fence.char && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = undefined;
    } else if (!fence) {
      const match = /^(#{1,2})[ \t]+(.+?)[ \t]*$/.exec(trimmed);
      if (match) headings.push({ name: match[2]!, level: match[1]!.length, start: offset });
    }
    offset += line.length;
  }
  const matches = headings.filter((item) => item.level === 2 && item.name === heading);
  if (matches.length !== 1) throw new Error("目标二级标题必须真实存在且唯一。");
  const index = headings.indexOf(matches[0]!);
  const end = headings[index + 1]?.start ?? before.length;
  const prefix = before.slice(0, end);
  const newline = before.includes("\r\n") ? "\r\n" : "\n";
  const separator = prefix.endsWith(newline + newline) ? "" : prefix.endsWith(newline) ? newline : newline + newline;
  const addition = text.replace(/\r?\n/g, newline);
  return prefix + separator + addition + newline + newline + before.slice(end);
}

export async function appendToHeading(
  vault: string, relativePath: string, heading: string, text: string,
  approve: (change: ProposedChange) => Promise<boolean>, signal: AbortSignal, lockDirectory: string,
): Promise<"applied" | "rejected"> {
  const path = await notePath(vault, relativePath, true);
  const previous = queues.get(path) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    if (signal.aborted) return "rejected" as const;
    let compromised = false;
    const release = await lock(path, { realpath: false, retries: 0, stale: 30000, update: 10000,
      lockfilePath: join(lockDirectory, `note-${createHash("sha256").update(policyPath(path)).digest("hex")}.lock`),
      onCompromised: () => { compromised = true; } });
    try {
      const snapshot = await inspectNote(vault, relativePath);
      const after = appendText(snapshot.text, heading, text);
      if (Buffer.byteLength(after) > MAX_BYTES) throw new Error("变更后的笔记超过 1 MiB 限制。");
      if (!await approve({ path, before: snapshot.text, after }) || signal.aborted || compromised) return "rejected" as const;
      const current = await inspectNote(vault, relativePath);
      if (current.text !== snapshot.text || current.dev !== snapshot.dev || current.ino !== snapshot.ino) {
        throw new Error("审批期间笔记发生变化，请重新检查并申请批准。");
      }
      const temporary = join(dirname(path), `.personal-life-os-${crypto.randomUUID()}.tmp`);
      let created = false;
      try {
        const file = await open(temporary, "wx", 0o600); created = true;
        try { await file.writeFile(after, "utf8"); await file.sync(); } finally { await file.close(); }
        if (signal.aborted) return "rejected" as const;
        const latest = await inspectNote(vault, relativePath);
        if (latest.text !== snapshot.text || latest.ino !== snapshot.ino || latest.dev !== snapshot.dev) {
          throw new Error("写入前笔记发生变化，请重新检查并申请批准。");
        }
        if (signal.aborted || compromised) return "rejected" as const;
        await rename(temporary, path); created = false;
        return "applied" as const;
      } finally { if (created) await unlink(temporary); }
    } finally { await release(); }
  });
  queues.set(path, operation);
  try { return await operation; } finally { if (queues.get(path) === operation) queues.delete(path); }
}
