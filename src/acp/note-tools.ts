import { lstat, open, realpath, rename, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { lock } from "proper-lockfile";
import { constants } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { policyPath, forbidsDirectWrite } from "./path-policy";
export { policyPath } from "./path-policy";
import type { ProposedChange } from "./approval";

const queues = new Map<string, Promise<unknown>>();
const MAX_BYTES = 1024 * 1024;

async function notePath(vault: string, relativePath: string, writing = false): Promise<string> {
  const parts = relativePath.split("/");
  if (isAbsolute(relativePath) || /[\\:\x00-\x1f]/.test(relativePath) ||
      parts.some((part) => !part || part.startsWith(".")) || !relativePath.toLowerCase().endsWith(".md")) {
    throw new Error("仅接受仓库内普通 Markdown 笔记的相对路径。");
  }
  if (writing && forbidsDirectWrite(relativePath)) {
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

function headingRange(before: string, heading: string, level: number) {
  if (!heading.trim() || /[\r\n]/.test(heading) || ![2, 3].includes(level)) throw new Error("标题与级别无效。");
  const lines = before.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  let offset = 0;
  let fence: { char: string; length: number } | undefined;
  const headings: { name: string; level: number; start: number; body: number }[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/\r?\n$/, "");
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(trimmed);
    if (marker) {
      if (!fence) fence = { char: marker[1]![0]!, length: marker[1]!.length };
      else if (marker[1]![0] === fence.char && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = undefined;
    } else if (!fence) {
      const match = /^(#{1,6})[ \t]+(.+?)[ \t]*$/.exec(trimmed);
      if (match) headings.push({ name: match[2]!, level: match[1]!.length, start: offset, body: offset + line.length });
    }
    offset += line.length;
  }
  const matches = headings.filter((item) => item.level === level && item.name === heading);
  if (matches.length !== 1) throw new Error("目标标题必须真实存在且唯一。");
  const index = headings.indexOf(matches[0]!);
  let end = headings.slice(index + 1).find(item => item.level <= level)?.start ?? before.length;
  const settings = before.indexOf("\n%% kanban:settings", matches[0]!.body);
  if (settings >= 0) end = Math.min(end, settings + 1);
  return { start: matches[0]!.body, end };
}

function appendText(before: string, heading: string, text: string, level: number) {
  if (!text.trim()) throw new Error("追加内容不能为空。");
  const { end } = headingRange(before, heading, level);
  const prefix = before.slice(0, end);
  const newline = before.includes("\r\n") ? "\r\n" : "\n";
  const separator = prefix.endsWith(newline + newline) ? "" : prefix.endsWith(newline) ? newline : newline + newline;
  const addition = text.replace(/\r?\n/g, newline);
  return prefix + separator + addition + newline + newline + before.slice(end);
}

export async function changeNote(
  vault: string, relativePath: string, transform: (before: string) => string,
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
      const after = transform(snapshot.text);
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

export async function appendToHeading(
  vault: string, relativePath: string, heading: string, text: string,
  approve: (change: ProposedChange) => Promise<boolean>, signal: AbortSignal, lockDirectory: string, level = 2,
) {
  return changeNote(vault, relativePath, before => appendText(before, heading, text, level), approve, signal, lockDirectory);
}

export function propertyChange(before: string, key: string, value: string | number | boolean | string[]) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error("属性键无效。");
  if (/^(dq_|wheel_)/.test(key) && (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10)) throw new Error("评分必须是 1 到 10 的整数。");
  if (key.startsWith("habit_") && typeof value !== "boolean") throw new Error("习惯属性必须是布尔值。");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(before);
  if (!frontmatter) throw new Error("缺少现有 frontmatter，不创建属性。");
  const lines = frontmatter[1]!.split(/\r?\n/);
  const matching = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.startsWith(key + ":"));
  if (matching.length !== 1) throw new Error("属性必须已存在且唯一，不新增或重命名键。");
  const { index, line } = matching[0]!;
  if (/[|>]\s*$/.test(line) || (lines[index + 1] && /^[ \t]+\S|^-/.test(lines[index + 1]!))) throw new Error("仅可更新单行标量属性。");
  const parsed = Bun.YAML.parse(frontmatter[1]!) as Record<string, unknown>;
  if (parsed[key] !== null && typeof parsed[key] === "object" && !(Array.isArray(parsed[key]) && (parsed[key] as unknown[]).every(item => typeof item === "string"))) throw new Error("复杂属性需使用原生设置。");
  lines[index] = `${key}: ${JSON.stringify(value)}`;
  const newline = before.includes("\r\n") ? "\r\n" : "\n";
  return "---" + newline + lines.join(newline) + newline + "---" + (frontmatter[0].endsWith(newline) ? newline : "") + before.slice(frontmatter[0].length);
}

export function sectionChange(document: string, heading: string, before: string, after: string, level = 2) {
  if (!before || before === after) throw new Error("必须提供真实原文和不同的新文本。");
  if (/^#{1,6}[ \t]/m.test(before) || /^#{1,6}[ \t]/m.test(after)) throw new Error("局部替换不得增加、删除或移动章节标题。");
  const range = headingRange(document, heading, level);
  const section = document.slice(range.start, range.end);
  const offset = section.indexOf(before);
  if (offset < 0 || section.indexOf(before, offset + 1) >= 0) throw new Error("原文必须在指定章节中准确匹配且唯一。");
  return document.slice(0, range.start + offset) + after + document.slice(range.start + offset + before.length);
}

export function moveCard(before: string, from: string, to: string, card: string) {
  if (from === to || !/^- \[[ xX]\] \S/.test(card) || /[\r\n]/.test(card)) throw new Error("需要不同来源和目标列，以及完整单行卡片。");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(before);
  if (!frontmatter || !(Bun.YAML.parse(frontmatter[1]!) as Record<string, unknown>)["kanban-plugin"]) throw new Error("目标不是已配置的看板。");
  const newline = before.includes("\r\n") ? "\r\n" : "\n";
  if (before.split(/\r?\n/).filter(line => line === card).length !== 1) throw new Error("卡片必须在看板中唯一。");
  // Compute both lane changes in memory, then approve and commit a single complete diff.
  const moved = appendText(before, to, card, 2);
  return sectionChange(moved, from, card + newline, "", 2);
}
