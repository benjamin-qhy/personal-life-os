import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface VaultArtifact { path: string; content: string }
const source = resolve(import.meta.dir, "../obsidian/views");

export const quickAddCaptureDefaults: Readonly<Record<string, { target: string; headings: readonly string[] }>> = {
  "lifeos-journal": { target: "01 Journal/Daily/{{DATE:YYYY-MM-DD}}.md", headings: ["日记", "Journal"] },
  "lifeos-win": { target: "01 Journal/Daily/{{DATE:YYYY-MM-DD}}.md", headings: ["收获", "Wins"] },
  "lifeos-gratitude": { target: "01 Journal/Daily/{{DATE:YYYY-MM-DD}}.md", headings: ["感恩", "Gratitude"] },
  "lifeos-task": { target: "08 Tasks/Tasks.md", headings: ["收件箱", "Inbox"] },
  "lifeos-newsletter-idea": { target: "06 Writing/Newsletters/Newsletter Board.md", headings: ["想法", "Ideas", "Backlog"] },
  "lifeos-video-idea": { target: "06 Writing/YouTube Scripts/YouTube Board.md", headings: ["想法", "Ideas", "Backlog"] },
  "lifeos-article-idea": { target: "06 Writing/Articles/Article Board.md", headings: ["想法", "Ideas", "Backlog"] },
  "lifeos-project-idea": { target: "04 Projects/Projects Board.md", headings: ["想法", "Ideas", "Backlog"] },
};

/** QuickAdd formats captureTo before insertAfter, executing each fenced script. */
export async function compileQuickAddCapture(key: string, target: string, headings: readonly string[]): Promise<{ captureTo: string; after: string }> {
  if (/[{}]/.test(target.replaceAll("{{DATE:YYYY-MM-DD}}", ""))) throw new Error("不支持的 QuickAdd 捕获目标格式。");
  const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser" });
  const script = await transpiler.transform(await readFile(resolve(import.meta.dir, "../obsidian/quickadd-scripts/resolve-heading.ts"), "utf8"));
  const config = JSON.stringify({ key: `lifeos.capture.${key}`, target, headings });
  const wrap = (call: string) => `\`\`\`js quickadd\n${script}\nreturn await ${call}(this, ${config});\n\`\`\``;
  return { captureTo: wrap("captureTarget"), after: wrap("captureHeading") };
}

/** Inspect generated settings without executing code from an untrusted candidate. */
export async function quickAddCaptureTarget(id: string, captureTo: string, after: string): Promise<string> {

  if (!captureTo.startsWith("```js quickadd")) {
    if (id in quickAddCaptureDefaults) throw new Error("第一方 QuickAdd 捕获缺少中英文章节适配脚本。");
    return captureTo;
  }
  const match = /\nreturn await captureTarget\(this, (.+)\);\n```$/.exec(captureTo);
  if (!match) throw new Error("QuickAdd 捕获脚本不是第一方生成格式。");
  const config: unknown = JSON.parse(match[1]!);
  if (!config || typeof config !== "object" || !("target" in config) || typeof config.target !== "string" ||
    !("headings" in config) || !Array.isArray(config.headings) || !config.headings.length ||
    config.headings.some(heading => typeof heading !== "string") || !("key" in config) || config.key !== `lifeos.capture.${id}`) {
    throw new Error("QuickAdd 捕获脚本参数无效。");
  }

  const defaults = quickAddCaptureDefaults[id];
  if (!defaults || config.target !== defaults.target || JSON.stringify(config.headings) !== JSON.stringify(defaults.headings)) {
    throw new Error("QuickAdd 捕获目标或章节与发行默认值不一致。");
  }
  const expected = await compileQuickAddCapture(id, defaults.target, defaults.headings);
  if (captureTo !== expected.captureTo || after !== expected.after) throw new Error("QuickAdd 捕获脚本与当前第一方源码不一致。");
  return config.target;
}

/** Dataview supplies the host globals; TypeScript imports here are types only. */
export async function compileVaultArtifacts(): Promise<VaultArtifact[]> {
  const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser" });
  const result: VaultArtifact[] = [];
  for (const file of (await readdir(source)).sort()) {
    if (!file.endsWith(".ts") || file === "host.ts") continue;
    result.push({ path: `Meta/views/${file.replace(/\.ts$/, ".js")}`,
      content: await transpiler.transform(await readFile(join(source, file), "utf8")) });
  }
  result.push(...await compileTemplates());
  result.push(...await compileDashboards());
  return result;
}

export async function compileTemplates(): Promise<VaultArtifact[]> {
  const templates = resolve(import.meta.dir, "../../Templates");
  const scripts = resolve(import.meta.dir, "../obsidian/template-scripts");
  const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser" });
  const compiled = new Map<string, string>();
  for (const file of (await readdir(scripts)).sort()) {
    if (!file.endsWith(".ts") || file === "host.ts") continue;
    const ts = await readFile(join(scripts, file), "utf8");
    const mode = ts.split("\n")[0]!;
    const js = await transpiler.transform(ts);
    compiled.set(file.slice(0, -3), mode.includes("dataview") ? js : `<%*\n${js}\n${mode.includes("-trim") ? "-" : ""}%>`);
  }
  const expand = (text: string, depth = 0): string => {
    if (depth > 5) throw new Error("模板脚本引用循环。");
    return text.replace(/\{\{lifeos-script:([a-z0-9-]+)\}\}/g, (_match, name: string) => {
      const script = compiled.get(name);
      if (script === undefined) throw new Error("模板脚本缺失。");
      return expand(script, depth + 1);
    });
  };
  return Promise.all((await readdir(templates)).filter(f => f.endsWith(".md")).sort().map(async file => ({
    path: `Templates/${file}`, content: expand(await readFile(join(templates, file), "utf8")),
  })));
}

/** Compile dashboard script markers into the Markdown consumed by Dataview. */
export async function compileDashboards(): Promise<VaultArtifact[]> {
  const dashboards = resolve(import.meta.dir, "../../00 Dashboards");
  const scripts = resolve(import.meta.dir, "../obsidian/dashboard-scripts");
  const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser" });
  const compiled = new Map<string, string>();
  for (const file of (await readdir(scripts)).sort()) {
    if (!file.endsWith(".ts") || file === "host.ts") continue;
    compiled.set(file.slice(0, -3), await transpiler.transform(await readFile(join(scripts, file), "utf8")));
  }
  return Promise.all((await readdir(dashboards)).filter(file => file.endsWith(".md")).sort().map(async file => {
    const markdown = await readFile(join(dashboards, file), "utf8");
    const content = markdown.replace(/\{\{lifeos-dashboard:([a-z0-9-]+)\}\}/g, (_match, name: string) => {
      const script = compiled.get(name);
      if (script === undefined) throw new Error("仪表盘脚本缺失。");
      return script;
    });
    return { path: `00 Dashboards/${file}`, content };
  }));
}
