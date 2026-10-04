import { expect, test } from "bun:test";
import moment from "moment";

test("生成的周复盘视图以中文展示日记分数和平均值", async () => {
  const { compileVaultArtifacts } = await import("../../src/tooling/build-vault-assets");
  const artifact = (await compileVaultArtifacts()).find(a => a.path === "Meta/views/week.js")!;
  const pages = [
    { file: { name: "2026-09-28", path: "01 Journal/Daily/2026-09-28.md", frontmatter: { dq_focus: 6, habit_reading: true } } },
    { file: { name: "2026-09-29", path: "01 Journal/Daily/2026-09-29.md", frontmatter: { dq_focus: 8, habit_reading: false } } },
    { file: { name: "2026-09-30", path: "01 Journal/Daily/2026-09-30.md", frontmatter: { dq_focus: true, habit_reading: false } } },
    { file: { name: "2026-10-01", path: "01 Journal/Daily/2026-10-01.md", frontmatter: { dq_focus: 11, habit_reading: false } } },
  ];
  let headers: string[] = [], rows: unknown[][] = [];
  const dv = { page: () => ({}), pages: () => ({ array: () => pages }),
    fileLink: (_path: string, _embed: boolean, title: string) => title,
    table: (h: string[], r: unknown[][]) => { headers = h; rows = r; }, paragraph() {} };
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  await new AsyncFunction("dv", "input", "moment", artifact.content)(dv, { week: "2026-W40" }, moment);
  expect(headers[0]).toBe("日期");
  expect(headers.at(-1)).toBe("习惯");
  expect(rows.at(-1)).toEqual(["**平均**", "7.0", ""]);
});

class DisplayElement {
  children: DisplayElement[] = [];
  style: Record<string, string> = {};
  innerHTML = "";
  value = "";
  checked = false;
  selected = false;
  constructor(readonly tag = "root", public text = "") {}
  createEl(tag: string, options: { text?: string; cls?: string; attr?: Record<string, string> } = {}) {
    const child = new DisplayElement(tag, options.text || ""); this.children.push(child); return child;
  }
  setText(text: string) { this.text = text; }
  appendText(text: string) { this.text += text; }
  addEventListener() {}
  all(): DisplayElement[] { return [this, ...this.children.flatMap(child => child.all())]; }
}

test.each([
  { customAgents: [{ id: "personal-life-os-pi", command: "bun", args: ["private-argument"], enabled: true }], expected: "✅" },
  { customAgents: [{ id: "personal-life-os-pi", command: "bun", enabled: false }], expected: "⬜" },
  { customAgents: [{ id: "personal-life-os-pi", command: "   ", enabled: true }], expected: "⬜" },
  { presetAgents: { codex: { command: "codex" } }, expected: "✅" },
])("设置清单识别已启用自定义或预置代理且不显示启动参数 %j", async ({ expected, ...settings }) => {
  const { compileVaultArtifacts } = await import("../../src/tooling/build-vault-assets");
  const artifact = (await compileVaultArtifacts()).find(a => a.path === "Meta/views/setup.js")!;
  const root = new DisplayElement();
  const emptyPages = { length: 0, where() { return this; }, array: () => [] };
  const dv = { container: root, page: () => ({}), current: () => ({}), pages: () => emptyPages };
  const app = {
    vault: { adapter: { read: async (path: string) => path.includes("agent-client") ? JSON.stringify(settings) : "{}" }, getFileByPath: () => null, getAbstractFileByPath: () => null },
    plugins: { enabledPlugins: new Set(), plugins: {} }, commands: { findCommand: () => null },
    customCss: { enabledSnippets: new Set() }, hotkeyManager: { customKeys: {} }, internalPlugins: { plugins: {} },
  };
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  await new AsyncFunction("dv", "app", "moment", "navigator", artifact.content)(dv, app, moment, { userAgent: "Mac" });
  const row = root.all().find(element => element.tag === "tr" && element.children[1]?.text === "Agent Client 已配置本地代理启动路径");
  expect(row?.children[0]?.text).toBe(expected);
  expect(root.all().map(element => element.text).join(" ")).not.toContain("private-argument");
});


async function renderPropertyView(view: string, frontmatter: Record<string, unknown>) {
  const { compileVaultArtifacts } = await import("../../src/tooling/build-vault-assets");
  const artifact = (await compileVaultArtifacts()).find(a => a.path === `Meta/views/${view}.js`)!;
  const root = new DisplayElement();
  const page = { file: { name: "2026-10-04", frontmatter } };
  const pages = { where() { return this; }, array: () => [page] };
  const dv = { container: root, page: (path: string) => path === "Meta/Compass Config" ? {} : page, pages: () => pages };
  const input = view === "wheel" ? { page: "02 Retreats/合成静修" } : { from: "2026-10-04", to: "2026-10-04" };
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  await new AsyncFunction("dv", "input", "moment", artifact.content)(dv, input, moment);
  return root;
}

test("人生之轮仅用1至10的有限数值计算领域与均值，不将布尔或越界值转换为分数", async () => {
  const root = await renderPropertyView("wheel", {
    wheel_health: 6, wheel_family: 7, wheel_growth: 8,
    wheel_boolean: true, wheel_string: "9", wheel_zero: 0, wheel_high: 11,
    wheel_negative: -1, wheel_infinity: Infinity, wheel_nan: NaN,
  });
  expect(root.all().map(el => el.text).join(" ")).toContain("平均 7.0 / 10");
  const html = root.all().map(el => el.innerHTML).join("");
  let labels = 0;
  await new HTMLRewriter().on("text", { element() { labels++; } }).transform(new Response(html)).text();
  expect(labels).toBe(3);
});

test("人生之轮把自定义属性标签作为文字显示，不在SVG中注入元素", async () => {
  const root = await renderPropertyView("wheel", { "wheel_<script>攻击</script>": 6, wheel_family: 7, wheel_growth: 8 });
  const html = root.all().map(el => el.innerHTML).join("");
  let scripts = 0;
  let labelText = "";
  await new HTMLRewriter().on("script", { element() { scripts++; } })
    .on("text", { text(chunk) { labelText += chunk.text; } }).transform(new Response(html)).text();
  expect(scripts).toBe(0);
  expect(labelText).toContain("&lt;script&gt;攻击&lt;/script&gt; (6)");
});

test("每日问题表格保留自定义标签文本而不把标签中的标记解析为元素", async () => {
  const root = await renderPropertyView("dailyquestions", { "dq_<script>攻击&标签</script>": 8 });
  const html = root.all().map(el => el.innerHTML).join("");
  let scripts = 0;
  let tableText = "";
  await new HTMLRewriter().on("script", { element() { scripts++; } })
    .on("td", { text(chunk) { tableText += chunk.text; } }).transform(new Response(html)).text();
  expect(scripts).toBe(0);
  expect(tableText).toContain("&lt;script&gt;攻击&amp;标签&lt;/script&gt;");
  expect(tableText).toContain("8.0");
});
