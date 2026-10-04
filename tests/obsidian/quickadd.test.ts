import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { safePluginSettings } from "../../src/tooling/build-template";

interface Choice { captureTo: string; insertAfter: { after: string; createIfNotFound: boolean } }
async function generatedChoice(target = "01 日记/每日/{{DATE:YYYY-MM-DD}}.md", heading = "## Journal"): Promise<Choice> {
  const dir = await mkdtemp(join(tmpdir(), "lifeos-quickadd-"));
  try {
    const path = join(dir, "data.json");
    await writeFile(path, JSON.stringify({ choices: [{ id: heading === "## Inbox" ? "lifeos-task" : "lifeos-journal", captureTo: target, insertAfter: { enabled: true, after: heading, createIfNotFound: true } }] }));
    const settings = await safePluginSettings("quickadd", path);
    return settings.choices[0];
  } finally { await rm(dir, { recursive: true, force: true }); }
}

// QuickAdd 2.23.0 SingleInlineScriptEngine binds the script's `this` to these parameters.
async function runFormat(format: string, host: object): Promise<string> {
  const script = /^```js quickadd\n([\s\S]*)\n```$/.exec(format);
  if (!script) return format;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return await new AsyncFunction(script[1]).call(host);
}

test("生成的 QuickAdd 捕获仅在实际目标的唯一中英文章节下追加", async () => {
  const choice = await generatedChoice();
  for (const heading of ["日记", "Journal"]) {
    const reads: string[] = [];
    const path = "01 日记/每日/2026-10-04.md";
    const host = {
      variables: {},
      quickAddApi: { format: async () => path },
      app: {
        vault: { getFileByPath: (target: string) => { reads.push(target); return { path: target }; } },
        metadataCache: { getFileCache: () => ({ headings: [{ level: 2, heading }] }) },
      },
    };
    expect(await runFormat(choice.captureTo, host)).toBe(path);
    expect(await runFormat(choice.insertAfter.after, host)).toBe(`## ${heading}`);
    expect(reads).toEqual([path]);
    expect(choice.insertAfter.createIfNotFound).toBe(false);
  }
});

test.each([{ headings: [] }, { headings: ["日记", "Journal"] }, { headings: ["Journal", "Journal"] }])("捕获缺失或重复章节 %j 时停止，不新建同义标题", async ({ headings }) => {
  const choice = await generatedChoice();
  const host = { variables: {}, quickAddApi: { format: async () => "01 日记/每日/test.md" }, app: {
    vault: { getFileByPath: (path: string) => ({ path }) },
    metadataCache: { getFileCache: () => ({ headings: headings.map(heading => ({ level: 2, heading })) }) },
  } };
  await runFormat(choice.captureTo, host);
  await expect(runFormat(choice.insertAfter.after, host)).rejects.toThrow("唯一");
  expect(choice.insertAfter.createIfNotFound).toBe(false);
});

test("新建日记等待目标标题缓存，变量使用 QuickAdd 的 Map 代理语义", async () => {
  const choice = await generatedChoice();
  const shared = new Map<string, unknown>();
  const variables = new Proxy({}, {
    get: (_target, key) => shared.get(String(key)),
    set: (_target, key, value) => { shared.set(String(key), value); return true; },
    deleteProperty: (_target, key) => { shared.delete(String(key)); return true; },
  });
  let calls = 0;
  const host = { variables, quickAddApi: { format: async () => "01 日记/每日/test.md" }, app: {
    vault: { getFileByPath: (path: string) => ({ path }) },
    metadataCache: { getFileCache: () => ++calls < 3 ? null : { headings: [{ level: 2, heading: "日记" }] } },
  } };
  await runFormat(choice.captureTo, host);
  expect(await runFormat(choice.insertAfter.after, host)).toBe("## 日记");
  expect(shared.size).toBe(0);
});

test("目标不存在、标题缓存未就绪或未解析目标时停止，不回退活动笔记", async () => {
  const choice = await generatedChoice();
  for (const missingFile of [true, false]) {
    const host = { variables: {}, quickAddApi: { format: async () => "01 日记/每日/test.md" }, app: {
      vault: { getFileByPath: (path: string) => missingFile ? null : { path } },
      metadataCache: { getFileCache: () => null },
    } };
    await expect(runFormat(choice.insertAfter.after, host)).rejects.toThrow("尚未解析");
    await runFormat(choice.captureTo, host);
    await expect(runFormat(choice.insertAfter.after, host)).rejects.toThrow(missingFile ? "不存在" : "尚未就绪");
  }
});

test("任务捕获只读取明确任务总表的标题缓存，无正文读取能力仍可定位", async () => {
  const choice = await generatedChoice("08 任务/任务总表.md", "## Inbox");
  for (const heading of ["收件箱", "Inbox"]) {
    const paths: string[] = [];
    const host = { variables: {}, quickAddApi: { format: async (text: string) => text }, app: {
      vault: { getFileByPath: (path: string) => { paths.push(path); return { path }; } },
      metadataCache: { getFileCache: () => ({ headings: [{ level: 2, heading }] }) },
    } };
    await runFormat(choice.captureTo, host);
    expect(await runFormat(choice.insertAfter.after, host)).toBe(`## ${heading}`);
    expect(paths).toEqual(["08 任务/任务总表.md"]);
  }
});
