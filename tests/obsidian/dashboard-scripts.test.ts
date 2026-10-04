import { expect, test } from "bun:test";
import { compileVaultArtifacts } from "../../src/tooling/build-vault-assets";

class Rows<T> {
  constructor(readonly values: T[]) {}
  where(predicate: (value: T) => boolean) { return new Rows(this.values.filter(predicate)); }
  sort(key: (value: T) => string, direction = "asc") { return new Rows([...this.values].sort((a, b) => key(a).localeCompare(key(b)) * (direction === "desc" ? -1 : 1))); }
  array() { return this.values; }
}

test("仪表盘构建产物在 Dataview 中保留中文项目关联和英文标签", async () => {
  const artifacts = await compileVaultArtifacts();
  const dashboard = artifacts.find(a => a.path === "00 仪表盘/项目仪表盘.md");
  expect(dashboard).toBeDefined();
  const script = dashboard!.content.match(/```dataviewjs\n([\s\S]*?)```/)![1]!;
  const pages = new Rows([
    { type: "project", status: "active", file: { name: "秋水项目", path: "04 项目/秋水项目.md", link: "中文项目", tasks: [{ tags: ["#project/秋水项目"], completed: false }] } },
    { type: "project", status: "active", file: { name: "English Project", path: "04 项目/English Project.md", link: "英文项目", tasks: [{ tags: ["#project/english-project"], completed: true }] } },
  ]);
  let headers: string[] = [], rows: unknown[][] = [];
  const dv = { page: () => ({}), pages: () => pages, table: (h: string[], r: unknown[][]) => { headers = h; rows = r; } };
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  await new AsyncFunction("dv", script)(dv);
  expect(headers).toEqual(["项目", "状态", "领域", "季度", "到期", "待办任务", "进度"]);
  expect(rows.find(r => r[0] === "中文项目")).toEqual(["中文项目", "进行中", "", "", "", 1, "0%"]);
  expect(rows.find(r => r[0] === "英文项目")).toEqual(["英文项目", "进行中", "", "", "", 0, "100%"]);
  expect(dashboard!.content).toContain('TABLE WITHOUT ID file.link AS "项目"');
});

test("仪表盘加载保留视图参数、每日问题中文文案和独立 Markdown 产物", async () => {
  const artifacts = await compileVaultArtifacts();
  const dashboards = artifacts.filter(a => a.path.startsWith("00 仪表盘/"));
  expect(dashboards).toHaveLength(8);
  const note = dashboards.find(a => a.path === "00 仪表盘/每日问题.md")!;
  const calls: Array<[string, unknown]> = [];
  let headers: string[] = [], rows: unknown[][] = [];
  const dv = {
    page: () => ({ questions: [{ key: "dq_focus", text: "今天是否尽力专注？" }] }),
    pages: () => new Rows([{ file: { name: "2026-10-04", link: "今日日记", frontmatter: { dq_focus: 8 } } }]),
    view: async (path: string, input: unknown) => { calls.push([path, input]); },
    table: (h: string[], r: unknown[][]) => { headers = h; rows = r; }, paragraph() {},
  };
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  for (const block of note.content.matchAll(/```dataviewjs\n([\s\S]*?)```/g)) await new AsyncFunction("dv", block[1])(dv);
  expect(calls).toEqual([["系统/views/dailyquestions", { days: 90 }]]);
  expect(headers).toEqual(["日期", "今天是否尽力专注？"]);
  expect(rows).toEqual([["今日日记", "8"]]);
  expect(dashboards.every(a => !a.content.includes("{{lifeos-dashboard:"))).toBe(true);
});
