import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { appendToHeading, inspectNote } from "../../src/acp/note-tools";

async function fixture() {
  await mkdir("build/acp-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/acp-tests/notes-"));
  const vault = join(root, "vault"); await mkdir(vault);
  await writeFile(join(vault, "note.md"), "# 合成笔记\n\n## 日记\n原有记录\n\n## 感恩\n其他内容\n");
  const locks = join(root, "locks"); await mkdir(locks);
  return { root, vault, locks, path: join(vault, "note.md") };
}

test("只在现有标题下追加，审批显示完整差异且保留其他文字", async () => {
  const f = await fixture();
  try {
    const before = await readFile(f.path, "utf8");
    const result = await appendToHeading(f.vault, "note.md", "日记", "今天的合成记录", async (change) => {
      expect(change.before).toBe(before);
      expect(change.after).toContain("原有记录\n\n今天的合成记录\n\n## 感恩");
      return true;
    }, new AbortController().signal, f.locks);
    expect(result).toBe("applied");
    expect(await readFile(f.path, "utf8")).toContain("## 感恩\n其他内容\n");
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("拒绝或审批期间内容变化时不覆盖文件", async () => {
  const f = await fixture();
  try {
    const before = await readFile(f.path, "utf8");
    expect(await appendToHeading(f.vault, "note.md", "日记", "新增", async () => false,
      new AbortController().signal, f.locks)).toBe("rejected");
    expect(await readFile(f.path, "utf8")).toBe(before);
    await expect(appendToHeading(f.vault, "note.md", "日记", "新增", async () => {
      await writeFile(f.path, before + "人工修改\n"); return true;
    }, new AbortController().signal, f.locks)).rejects.toThrow("变化");
    expect(await readFile(f.path, "utf8")).toBe(before + "人工修改\n");
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("拒绝目录穿越、隐藏目录、符号链接以及非笔记文件", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "outside.md"), "PRIVATE");
    await symlink(join(f.root, "outside.md"), join(f.vault, "linked.md"));
    for (const path of ["../outside.md", ".obsidian/test.md", "linked.md", "file.json", f.path]) {
      await expect(inspectNote(f.vault, path)).rejects.toThrow();
    }
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("标题必须唯一、真实存在，代码块中的标题不算", async () => {
  const f = await fixture();
  try {
    await writeFile(f.path, "```md\n## 日记\n```\n## 其他\n");
    await expect(appendToHeading(f.vault, "note.md", "日记", "新增", async () => true,
      new AbortController().signal, f.locks)).rejects.toThrow("标题");
    await writeFile(f.path, "## 日记\n\n## 日记\n");
    await expect(appendToHeading(f.vault, "note.md", "日记", "新增", async () => true,
      new AbortController().signal, f.locks)).rejects.toThrow("标题");
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("审批后取消不得写入；知识层写入须交给原有事务流程", async () => {
  const f = await fixture();
  try {
    const before = await readFile(f.path, "utf8");
    const controller = new AbortController();
    expect(await appendToHeading(f.vault, "note.md", "日记", "新增", async () => {
      controller.abort(); return true;
    }, controller.signal, f.locks)).toBe("rejected");
    expect(await readFile(f.path, "utf8")).toBe(before);
    await expect(appendToHeading(f.vault, "wiki/test.md", "日记", "新增", async () => true,
      new AbortController().signal, f.locks)).rejects.toThrow();
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("大小写变体不能绕过系统目录保护", async () => {
  const f = await fixture();
  try {
    for (const path of ["templates/test.md", "WIKI/test.md", "META/test.md", "prompts/test.md", "readme.MD"]) {
      await expect(appendToHeading(f.vault, path, "日记", "新增", async () => true,
        new AbortController().signal, f.locks)).rejects.toThrow("不支持直接追加");
    }
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("独立进程不能在另一进程审批期间修改同一笔记", async () => {
  const f = await fixture();
  const ready = Promise.withResolvers<void>();
  const permission = Promise.withResolvers<boolean>();
  const pending = appendToHeading(f.vault, "note.md", "日记", "第一进程", async () => {
    ready.resolve(); return permission.promise;
  }, new AbortController().signal, f.locks);
  try {
    await ready.promise;
    const module = resolve("src/acp/note-tools.ts");
    const script = `import {appendToHeading} from ${JSON.stringify(module)};
      try { await appendToHeading(${JSON.stringify(f.vault)}, "note.md", "日记", "第二进程", async()=>true,
        new AbortController().signal, ${JSON.stringify(f.locks)}); process.exit(1); }
      catch (e) { process.exit(e.code === "ELOCKED" ? 0 : 2); }`;
    const child = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
    expect(await child.exited).toBe(0);
    permission.resolve(true);
    expect(await pending).toBe("applied");
    const content = await readFile(f.path, "utf8");
    expect(content).toContain("第一进程");
    expect(content).not.toContain("第二进程");
  } finally { permission.resolve(false); await pending.catch(() => {}); await rm(f.root, { recursive: true, force: true }); }
});


test("最终读取期间取消也不能提交文件", async () => {
  const f = await fixture();
  const before = await readFile(f.path, "utf8");
  const controller = new AbortController();
  const original = fs.open;
  let reads = 0;
  const mock = spyOn(fs, "open").mockImplementation(async (...args) => {
    const file = await original(...args);
    if (args[0] === f.path && ++reads === 3) controller.abort();
    return file;
  });
  try {
    expect(await appendToHeading(f.vault, "note.md", "日记", "新增", async () => true,
      controller.signal, f.locks)).toBe("rejected");
    expect(reads).toBe(3);
    expect(await readFile(f.path, "utf8")).toBe(before);
  } finally { mock.mockRestore(); await rm(f.root, { recursive: true, force: true }); }
});
