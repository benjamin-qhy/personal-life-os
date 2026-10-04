import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import moment from "moment";
import { compileTemplates } from "../../src/tooling/build-vault-assets";

async function render(name: string, title: string) {
  const source = (await compileTemplates()).find(a => a.path === `模板/${name}.md`)!.content;
  const tp = { file: { title }, date: { now: (format: string, offset = 0, reference?: string, input?: string) => moment(reference || "2026-10-04", input).add(offset, "day").format(format) } };
  const app = { vault: { getFileByPath: () => null }, metadataCache: { getFileCache: () => null } };
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  let output = "", last = 0;
  for (const match of source.matchAll(/<%(\*?)([\s\S]*?)(-?)%>/g)) {
    output += source.slice(last, match.index);
    const code = match[1] ? `let tR = ""; ${match[2]}; return tR;` : `return (${match[2]});`;
    output += String(await new AsyncFunction("tp", "app", "moment", code)(tp, app, moment));
    last = match.index! + match[0].length;
  }
  return output + source.slice(last);
}

test("创建日记得到中文章节、稳定日期路径和每日属性", async () => {
  const note = await render("每日日记", "2026-10-04");
  expect(note).toContain("## 日记");
  expect(note).toContain("## 收获");
  expect(note).toContain("## 感恩");
  expect(note).toContain("dq_goals:");
  expect(note).toContain("habit_journal: false");
  expect(note).toContain("01 日记/每日/2026-10-03");
});

test("周与季度复盘创建中文章节并兼容收获查询", async () => {
  const week = await render("每周笔记", "2026-W40");
  expect(week).toContain("## 本周意图");
  expect(week).toContain('"收获"');
  expect(week).toContain('"Wins"');
  const quarter = await render("季度笔记", "2026-Q4");
  expect(quarter).toContain("## 季度意图");
  expect(await render("个人静修", "2026-Q4 个人静修")).toContain("## 3. 人生之轮");
});

test("往年日记通过 Obsidian 真实标题兼容中文和英文，不生成不存在的章节链接", async () => {
  const note = await render("每日日记", "2026-10-04");
  const script = note.split("## 历史上的今天")[1]!.match(/```dataviewjs\n([\s\S]*?)```/)![1]!;
  const pages = ["2025-10-04", "2024-10-04", "2023-10-04", "2027-10-04"].map(name => ({ file: { name, path: `01 日记/每日/${name}.md`, link: `[[${name}]]` } }));
  const collection = (values: typeof pages) => ({
    length: values.length,
    where: (predicate: (page: typeof pages[number]) => boolean) => collection(values.filter(predicate)),
    sort: (key: (page: typeof pages[number]) => string) => collection([...values].sort((a, b) => key(b).localeCompare(key(a)))),
    [Symbol.iterator]: () => values[Symbol.iterator](),
  });
  const paragraphs: string[] = [];
  const dv = { current: () => ({ file: { name: "2026-10-04" } }), page: () => ({}), pages: () => collection(pages),
    paragraph: (text: string) => paragraphs.push(text), header() {} };
  const app = {
    vault: { getFileByPath: (path: string) => ({ path }) },
    metadataCache: { getFileCache: (file: { path: string }) => ({ headings: file.path.includes("2025") ? [{ heading: "日记", level: 2 }] : file.path.includes("2024") ? [{ heading: "Journal", level: 2 }] : [] }) },
  };
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  await new AsyncFunction("dv", "app", script)(dv, app);
  expect(paragraphs).toContain("![[01 日记/每日/2025-10-04#日记]]");
  expect(paragraphs).toContain("![[01 日记/每日/2024-10-04#Journal]]");
  expect(paragraphs.some(text => text.includes("2023-10-04#"))).toBe(false);
  expect(paragraphs.some(text => text.includes("2027-10-04"))).toBe(false);
});

test("新建周期笔记的跨日和周内导航使用中文日记目录", async () => {
  const daily = await render("每日日记", "2026-10-04");
  expect(daily).toContain("01 日记/每日/2026-10-03");
  const weekly = await render("每周笔记", "2026-W40");
  expect(weekly).toContain("[[01 日记/每日/2026-09-30|9月30日]]");
  expect(weekly).not.toContain("01 Journal/");
});
