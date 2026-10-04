import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { compileTemplates } from "../../src/tooling/build-vault-assets";

// Templater is the external host adapter. Execute its expression interface and
// inspect the resulting note, without coupling tests to a slug implementation.
async function createNote(template: string, title: string): Promise<string> {
  const source = (await compileTemplates()).find(a => a.path === `Templates/${template}.md`)!.content;
  return source.replace(/<%\*([\s\S]*?)%>/g, (_, expression: string) => String(runInNewContext(`let tR = ""; ${expression}; tR`, {
    tp: { file: { title }, date: { now: (format: string) => format === "YYYY-[Q]Q" ? "2026-Q4" : "2026-10-04" } },
  })));
}

test("中文项目名称生成可复制且与任务查询一致的路由标签，英文名称保持兼容", async () => {
  const chinese = await createNote("Project", "秋季 写作计划");
  expect(chinese).toContain("`#project/秋季-写作计划`");
  expect(chinese).toContain("tags include #project/秋季-写作计划");
  expect(chinese).toContain("## 下一步行动");
  expect(await createNote("Project", "Write A Book")).toContain("#project/write-a-book");
});

test("中文人物的讨论和普通任务使用同一人物标签，保留关联项目查询", async () => {
  const note = await createNote("Person", "李 明");
  expect(note).toContain("`#p/李-明`");
  expect(note).toContain("#discuss #p/李-明");
  expect(note).toContain("tags include #p/李-明");
  expect(note).toContain("## 待讨论");
  expect(note).toContain('WHERE contains(people, this.file.link) AND status != "done"');
  expect(await createNote("Person", "Alex Chen")).toContain("#p/alex-chen");
});

test("文章生成中文写作引导并保留看板、来源和助手工作流", async () => {
  const note = await createNote("Article", "中文写作");
  expect(note).toContain("## 草稿");
  expect(note).toContain("[[Article Board|文章看板]]");
  expect(note).toContain('text: "协助创作这篇内容"');
  expect(note).toContain("Prompts/10 Writing Pipeline.md");
  expect(note).toContain("Prompt 章节");
  expect(note).toContain("meta_description:");
});

test("Newsletter 生成中文内容引导并保留笔记属性", async () => {
  const note = await createNote("Newsletter", "合成验收笔记");
  expect(note).toContain("## 正文");
  expect(note).toContain("type:");
});

test("YouTube Script 生成中文内容引导并保留笔记属性", async () => {
  const note = await createNote("YouTube Script", "合成验收笔记");
  expect(note).toContain("## 铺垫与意义");
  expect(note).toContain("type:");
  expect(note).toContain("working_title: 合成验收笔记");
});

test("Course Lesson 生成中文内容引导并保留笔记属性", async () => {
  const note = await createNote("Course Lesson", "合成验收笔记");
  expect(note).toContain("## 学习目标");
  expect(note).toContain("type:");
});

test("Book Note 生成中文内容引导并保留笔记属性", async () => {
  const note = await createNote("Book Note", "合成验收笔记");
  expect(note).toContain("## 三句话总结");
  expect(note).toContain("type:");
  expect(note).toContain("^quote-1");
  expect(note).toContain('FROM "06 Writing"');
});

test("Study Note 生成中文内容引导并保留笔记属性", async () => {
  const note = await createNote("Study Note", "合成验收笔记");
  expect(note).toContain("## 主要观点");
  expect(note).toContain("type:");
  expect(note).toContain("[[Genesis 1.1]]");
});
