import { createWriteStream } from "node:fs";
import { link, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import * as yauzl from "yauzl";
import { ZipFile } from "yazl";
import { exists, filesIn, put, sha256, pathKey } from "./files";

export function safeName(name: string): boolean {
  if (!name || /[\\:\x00-\x1f]/.test(name) || name.startsWith("/")) return false;
  return name.replace(/\/$/, "").split("/").every(part => !!part && part !== "." && part !== ".." &&
    !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
export async function writeManifest(root: string) {
  const lines: string[] = [];
  for (const rel of await filesIn(root)) {
    if (rel === "MANIFEST.sha256") continue;
    if (!safeName(rel)) throw new Error("清单路径不安全。");
    lines.push(`${sha256(await readFile(join(root, rel)))}  ${rel}`);
  }
  await writeFile(join(root, "MANIFEST.sha256"), lines.sort().join("\n") + "\n");
}
export async function verifyManifest(root: string): Promise<number> {
  const files = (await filesIn(root)).filter(rel => rel !== "MANIFEST.sha256");
  const expected = new Map<string, string>();
  const folded = new Set<string>();
  for (const line of (await readFile(join(root, "MANIFEST.sha256"), "utf8")).trimEnd().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || !safeName(match[2]!) || expected.has(match[2]!)) throw new Error("嵌入清单格式无效。");
    expected.set(match[2]!, match[1]!);
  }
  if (files.length !== expected.size || files.some(rel => !expected.has(rel))) throw new Error("恢复文件清单不一致。");
  for (const rel of files) {
    const key = pathKey(rel);
    if (folded.has(key)) throw new Error("清单存在大小写路径冲突。");
    folded.add(key);
    if (sha256(await readFile(join(root, rel))) !== expected.get(rel)) throw new Error("恢复文件校验失败。");
  }
  return files.length;
}

export async function createArchive(root: string, archive: string) {
  if (await exists(archive) || await exists(`${archive}.sha256`)) throw new Error("归档或校验文件已存在，拒绝覆盖。");
  const names = await filesIn(root);
  const prefix = basename(root);
  if (!safeName(prefix)) throw new Error("归档根目录无效。");
  await mkdir(dirname(archive), { recursive: true });
  const temporary = await mkdtemp(join(dirname(archive), ".life-os-zip-"));
  try {
    const zip = new ZipFile();
    const output = createWriteStream(join(temporary, "candidate.zip"), { flags: "wx", mode: 0o600 });
    zip.on("error", error => output.destroy(error));
    const writing = pipeline(zip.outputStream, output);
    for (const rel of names) {
      if (!safeName(rel)) throw new Error("归档文件路径无效。");
      zip.addFile(join(root, rel), `${prefix}/${rel}`);
    }
    zip.end(); await writing;
    const digest = sha256(await readFile(join(temporary, "candidate.zip")));
    await writeFile(join(temporary, "candidate.sha256"), `${digest}  ${basename(archive)}\n`, { mode: 0o600 });
    await link(join(temporary, "candidate.zip"), archive);
    try { await link(join(temporary, "candidate.sha256"), `${archive}.sha256`); }
    catch (error) { await rm(archive); throw error; }
    return digest;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function verifyArchive(archive: string): Promise<{ digest: string; count: number }> {
  const digest = sha256(await readFile(archive));
  const sidecar = (await readFile(`${archive}.sha256`, "utf8")).trimEnd();
  if (sidecar !== `${digest}  ${basename(archive)}`) throw new Error("归档 SHA256 校验失败。");
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.open(archive,
    { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true },
    (error, file) => error || !file ? reject(error) : resolve(file)));
  let temporary: string | undefined;
  try {
    const entries = await new Promise<yauzl.Entry[]>((resolve, reject) => {
      const items: yauzl.Entry[] = []; let bytes = 0;
      zip.on("error", reject);
      zip.on("entry", (item: yauzl.Entry) => {
        bytes += item.uncompressedSize; items.push(item);
        if (items.length > 10000 || bytes > 100_000_000) { reject(new Error("归档超过恢复测试限制。")); return; }
        zip.readEntry();
      });
      zip.on("end", () => resolve(items)); zip.readEntry();
    });
    const keys = new Set<string>(), roots = new Set<string>();
    for (const entry of entries) {
      const name = entry.fileName;
      if (name.endsWith("/") && (entry.uncompressedSize !== 0 || entry.crc32 !== 0)) throw new Error("归档目录条目校验失败。");
      const key = pathKey(name.replace(/\/$/, ""));
      if (!safeName(name) || keys.has(key)) throw new Error("归档包含不安全或重复路径。");
      keys.add(key); roots.add(name.split("/")[0]!);
      const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (![0, 0o100000, 0o040000].includes(mode) || entry.isEncrypted() ||
          (mode === 0o040000 && !name.endsWith("/"))) throw new Error("归档包含非常规或加密条目。");
    }
    if (roots.size !== 1) throw new Error("归档必须只有一个候选版本根目录。");
    temporary = await mkdtemp(join(tmpdir(), "life-os-restore-"));
    for (const entry of entries) {
      const target = join(temporary, entry.fileName);
      if (entry.fileName.endsWith("/")) { await mkdir(target, { recursive: true }); continue; }
      const stream = await new Promise<Readable>((resolve, reject) => zip.openReadStream(entry,
        (error, result) => error || !result ? reject(error) : resolve(result)));
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of stream) {
        const buffer = Buffer.from(chunk); size += buffer.length;
        if (size > entry.uncompressedSize) { stream.destroy(); throw new Error("归档解压大小超限。"); }
        chunks.push(buffer);
      }
      const bytes = Buffer.concat(chunks);
      if (Bun.hash.crc32(bytes) !== entry.crc32 || size !== entry.uncompressedSize) throw new Error("归档 CRC 校验失败。");
      await put(target, bytes);
    }
    return { digest, count: await verifyManifest(join(temporary, [...roots][0]!)) };
  } finally { zip.close(); if (temporary) await rm(temporary, { recursive: true, force: true }); }
}
