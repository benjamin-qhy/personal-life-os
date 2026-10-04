import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// Exercise the CLI as shipped: validation must finish before reporting success.
async function fixture() {
  await mkdir("build/tooling-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/tooling-tests/zip-"));
  const source = join(root, "Candidate"); await mkdir(source);
  await writeFile(join(source, "合成.txt"), "synthetic\n");
  return { root, source, archive: join(root, "candidate.zip") };
}
async function toolkit() { return import("../../src/tooling/archive"); }

test("完整 ZIP 临时恢复后与嵌入清单逐字节一致", async () => {
  const f = await fixture();
  try {
    const { writeManifest, createArchive, verifyArchive } = await toolkit();
    await writeManifest(f.source);
    await createArchive(f.source, f.archive);
    const result = await verifyArchive(f.archive);
    expect(result.count).toBe(1);
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    await expect(createArchive(f.source, f.archive)).rejects.toThrow();
    await writeFile(`${f.archive}.sha256`, "0".repeat(64) + "  candidate.zip\n");
    await expect(verifyArchive(f.archive)).rejects.toThrow("校验");
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("归档路径拒绝穿越、绝对路径、重复分隔与平台别名", async () => {
  const { safeName } = await toolkit();
  for (const path of ["../escape", "/absolute", "root/../escape", "root\\escape", "C:/escape", "root//file", "root/./file", "root/a\n"]) {
    expect(safeName(path)).toBe(false);
  }
  expect(safeName("Candidate/使用指南/开始.md")).toBe(true);
});

test("清单不匹配的归档即使外部摘要正确也被拒绝", async () => {
  const f = await fixture();
  try {
    const { writeManifest, createArchive, verifyArchive } = await toolkit();
    await writeManifest(f.source);
    await writeFile(join(f.source, "合成.txt"), "changed\n");
    await createArchive(f.source, f.archive);
    await expect(verifyArchive(f.archive)).rejects.toThrow("校验");
    expect(await readFile(join(f.source, "合成.txt"), "utf8")).toBe("changed\n");
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("拒绝穿越、重复路径、符号链接和 CRC 损坏条目", async () => {
  const { ZipFile } = await import("yazl");
  const { sha256 } = await import("../../src/tooling/files");
  const { verifyArchive } = await toolkit();
  for (const variant of ["traversal", "duplicate", "symlink", "crc"] as const) {
    const f = await fixture();
    try {
      const zip = new ZipFile();
      zip.addBuffer(Buffer.from("synthetic"), "aa/escape", { mode: variant === "symlink" ? 0o120777 : 0o100644 });
      if (variant === "duplicate") zip.addBuffer(Buffer.from("another"), "aa/escape");
      const chunks: Buffer[] = [];
      const read = (async () => { for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk)); })();
      zip.end(); await read;
      const bytes = Buffer.concat(chunks);
      if (variant === "traversal") {
        for (let at = bytes.indexOf("aa/escape"); at >= 0; at = bytes.indexOf("aa/escape", at + 1)) bytes.write("../escape", at);
      }
      if (variant === "crc") {
        const at = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
        bytes[at + 16] = bytes[at + 16]! ^ 1;
      }
      await writeFile(f.archive, bytes);
      await writeFile(`${f.archive}.sha256`, `${sha256(bytes)}  candidate.zip\n`);
      await expect(verifyArchive(f.archive)).rejects.toThrow();
    } finally { await rm(f.root, { recursive: true, force: true }); }
  }
});

test("Unicode 大小写折叠冲突及损坏目录记录均不能恢复", async () => {
  const { ZipFile } = await import("yazl");
  const { sha256 } = await import("../../src/tooling/files");
  const { verifyArchive } = await toolkit();
  for (const variant of ["fold", "directory"] as const) {
    const f = await fixture();
    try {
      const zip = new ZipFile();
      const content = Buffer.from("synthetic");
      zip.addBuffer(content, "Candidate/Straße.md");
      const paths = ["Straße.md"];
      if (variant === "fold") { zip.addBuffer(content, "Candidate/STRASSE.md"); paths.push("STRASSE.md"); }
      else zip.addEmptyDirectory("Candidate/empty");
      zip.addBuffer(Buffer.from(paths.map(p => `${sha256(content)}  ${p}`).join("\n") + "\n"), "Candidate/MANIFEST.sha256");
      const chunks: Buffer[] = []; const read = (async () => { for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk)); })();
      zip.end(); await read; const bytes = Buffer.concat(chunks);
      if (variant === "directory") {
        for (let at = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); at >= 0; at = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), at + 4)) {
          if (bytes.subarray(at + 46, at + 46 + bytes.readUInt16LE(at + 28)).toString().endsWith("empty/")) bytes[at + 16] = 1;
        }
      }
      await writeFile(f.archive, bytes); await writeFile(`${f.archive}.sha256`, `${sha256(bytes)}  candidate.zip\n`);
      await expect(verifyArchive(f.archive)).rejects.toThrow();
    } finally { await rm(f.root, { recursive: true, force: true }); }
  }
});
