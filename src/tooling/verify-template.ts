import { readFile, stat } from "node:fs/promises";
import { basename, join, resolve, dirname } from "node:path";
import { exists, filesIn, readJson, pathKey } from "./files";
import { verifyManifest } from "./archive";
import { compilePiRuntime } from "./build-pi-runtime";
import { runtimeLicenses } from "./runtime-licenses";
import { quickAddCaptureTarget } from "./build-vault-assets";

export interface Check { check: string; ok: boolean; detail: string }
const SOURCE = resolve(import.meta.dir, "../..");
const FORBIDDEN = [/agricidaniel/, /\/var\/home/, /\/home\/[a-z]/, /\/Users\//, /C:\\\\Users/,
  /@gmail\.com/, /@proton/, /BEGIN CERTIFICATE/, /BEGIN RSA/, /privateKey/, /"apiKey": "[A-Za-z0-9]/,
  /\bsk-[A-Za-z0-9]{8}/, /AKIA[0-9A-Z]{12}/, /xoxb-/, /ghp_[A-Za-z0-9]/, /Bearer [A-Za-z0-9]{16}/,
  /Decision taken 20/, /tested 20\d\d/, /on this machine/, /\u2014/];
const USER = ["01 Journal/", "02 Retreats/", "04 Projects/", "05 People/", "06 Writing/", "07 Library/", "09 Reading/Chapters/", "09 Reading/Verses/", "09 Reading/Study Notes/", "09 Reading/Topics/"];
const DATE_LINK = /^\d{4}-(\d\d-\d\d|W\d\d|Q\d( Personal Retreat)?)$/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function verifyTemplate(root: string): Promise<Check[]> {
  const results: Check[] = [];
  const check = (name: string, ok: unknown, detail = "") => results.push({ check: name, ok: !!ok, detail });
  const present = (rel: string) => exists(join(root, rel));
  const load = async (rel: string): Promise<Record<string, any> | null> => await present(rel) ? readJson(join(root, rel)) : null;
  let files: string[];
  try { files = await filesIn(root); }
  catch { return [{ check: "普通文件检查", ok: false, detail: "目录不存在或包含符号链接、非常规文件，正文扫描已跳过。" }]; }
  try {
    for (const marker of [".vault-meta", ".mcp.json", ".claude/settings.local.json", ".env", "node_modules", "src/acp"]) {
      if (await present(marker)) throw new Error();
    }
    for (const plugin of ["obsidian-local-rest-api", "agent-client"]) {
      const data = await load(`.obsidian/plugins/${plugin}/data.json`);
      if (data && (data.apiKey || data.crypto || (data.savedSessions && (!Array.isArray(data.savedSessions) || data.savedSessions.length)))) throw new Error();
    }
  } catch { return [{ check: "发行副本预检查", ok: false, detail: "发现机器配置或无效设置，正文扫描已跳过；请先生成脱敏副本。" }]; }
  check("无大小写路径冲突", new Set(files.map(pathKey)).size === files.length);
  try { await verifyManifest(root); check("清单精确覆盖候选文件", true); }
  catch { check("清单精确覆盖候选文件", false); }
  const runtimeFiles = new Set(["scripts/ai-runtime/pi-acp.js", "scripts/ai-runtime/THIRD_PARTY_LICENSES.txt"]);
  let verifiedRuntime = false;
  try {
    const expected = await compilePiRuntime();
    verifiedRuntime = Buffer.from(expected).equals(await readFile(join(root, "scripts/ai-runtime/pi-acp.js"))) &&
      await readFile(join(root, "scripts/ai-runtime/THIRD_PARTY_LICENSES.txt"), "utf8") === await runtimeLicenses(expected);
  } catch { /* Missing or altered runtime must fail provenance validation. */ }
  check("Pi 运行文件及许可证与当前源码构建一致", verifiedRuntime);
  const texts: Record<string, string> = {};
  for (const rel of files) {
    if (rel.startsWith(".obsidian/plugins/") && !rel.endsWith("data.json")) continue;
    // Dependency code contains credential field names and public certificate literals.
    // Exclude it from user-data heuristics only after exact source-build verification.
    if (verifiedRuntime && runtimeFiles.has(rel)) continue;
    if (/\.(md|js|mjs|ts|json|css|py|txt|yaml|yml)$/.test(rel)) {
      try { texts[rel] = await readFile(join(root, rel), "utf8"); } catch { /* Binary/non-UTF-8 resources have no text assertions. */ }
    }
  }
  const localPatterns = join(SOURCE, "scripts/template/forbidden.local.txt");
  const patterns = [...FORBIDDEN];
  if (await exists(localPatterns)) {
    for (const line of (await readFile(localPatterns, "utf8")).split(/\r?\n/)) if (line.trim() && !line.startsWith("#")) patterns.push(new RegExp(escape(line.trim())));
  }
  for (const [index, pattern] of patterns.entries()) {
    const hits = Object.entries(texts).filter(([rel, text]) => rel !== "scripts/RELEASE.md" && pattern.test(text));
    // Never echo configured private strings or matching note text.
    check(`敏感内容规则 ${index + 1}`, !hits.length, hits.slice(0, 5).map(([rel]) => rel).join(", "));
  }
  try {
    const ra = await load(".obsidian/plugins/obsidian-local-rest-api/data.json");
    check("REST API 仅启用本地非加密服务", ra && Object.keys(ra).length === 1 && ra.enableInsecureServer === true);
    const ac = await load(".obsidian/plugins/agent-client/data.json");
    check("Agent Client 无会话且自动批准关闭", ac && Array.isArray(ac.savedSessions) && !ac.savedSessions.length && ac.autoAllowPermissions === false &&
      Object.values(ac.presetAgents || {}).every((pa: any) => !String(pa?.command || "").startsWith("/")));
    const seo = await load(".obsidian/plugins/seo/data.json"); check("SEO 无缓存且扫描写作目录", seo && !("cachedGlobalResults" in seo) && seo.scanDirectories?.includes("06 Writing"));
    const om = await load(".obsidian/plugins/omnisearch/data.json"); check("Omnisearch HTTP 关闭", !om || (om.httpApiEnabled === false && !om.DANGER_httpHost));
    const qa = await load(".obsidian/plugins/quickadd/data.json"); check("QuickAdd 在线功能关闭且无密钥", qa && qa.disableOnlineFeatures === true && (qa.ai?.providers || []).every((p: any) => !p?.apiKey));
    const cp = await load(".obsidian/core-plugins.json"); check("核心插件配置", cp && cp.sync === false && cp.webviewer === true && cp.bases === true);
    const app = await load(".obsidian/app.json"); check("新文件保存在当前目录", app?.newFileLocation === "current");
    const ids: string[] = (await load(".obsidian/community-plugins.json") as unknown as string[]) || [];
    if (!Array.isArray(ids) || ids.some(id => !/^[a-z0-9-]+$/.test(id))) throw new Error();
    for (const id of ids) {
      const folder = `.obsidian/plugins/${id}`;
      check(`插件文件 ${id}`, (await Promise.all(["main.js", "manifest.json", "LICENSE"].map(file => present(`${folder}/${file}`)))).every(Boolean));
      const manifest = await load(`${folder}/manifest.json`);
      check(`第三方声明版本 ${id}`, manifest && texts["THIRD_PARTY_NOTICES.md"]?.includes(`| ${id} | ${manifest.version} |`));
    }
    for (const script of ["verify_life_os_app.ts", "verify_assistant_contracts.ts"]) {
      const child = Bun.spawn([process.execPath, join(SOURCE, "scripts", script), root], { stdout: "pipe", stderr: "pipe" });
      const output = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
      const code = await child.exited; await output;
      check(`应用契约 ${script}`, code === 0, code ? "应用契约未通过；请在合成环境运行对应验证器定位。" : "");
    }
    const tp = await load(".obsidian/plugins/templater-obsidian/data.json");
    for (const ft of tp?.folder_templates || []) check(`Templater 模板 ${ft.template}`, await present(ft.template || "") && await present(ft.folder || ""));
    const pn = await load(".obsidian/plugins/periodic-notes/data.json");
    for (const key of ["daily", "weekly", "quarterly"]) {
      const c = pn?.[key] || {};
      check(`周期笔记 ${key}`, !c.enabled || (await present(c.folder || "") && await present(c.template || "")));
    }
    for (const choice of qa?.choices || []) {
      const target = (await quickAddCaptureTarget(String(choice.id || ""), String(choice.captureTo || ""), String(choice.insertAfter?.after || ""))).replace(/\{\{DATE:[^}]*\}\}/g, "2000-01-01");
      if (target && (target.startsWith("/") || /[\\\x00-\x1f:{}]/.test(target) || target.split("/").some(part => !part || part.startsWith(".")))) throw new Error("捕获目标路径不安全。");
      check(`QuickAdd 捕获目标 ${choice.name}`, !target || await present(target) || (choice.createFileIfItDoesntExist?.enabled && await present(dirname(target))));
      if (choice.createFileIfItDoesntExist?.template) check(`QuickAdd 模板 ${choice.createFileIfItDoesntExist.template}`, await present(choice.createFileIfItDoesntExist.template));
    }
    for (const [rel, text] of Object.entries(texts)) if (rel.endsWith(".md")) {
      for (const match of text.matchAll(/"new-note-template":"([^"]+)"/g)) check(`看板模板 ${rel}`, await present(match[1]!));
    }
    const wv = await load(".obsidian/webviewer.json"); if (wv?.markdownPath) check("网页笔记目录", await present(wv.markdownPath));
    for (const ledger of ["source-ledger", "claim-ledger"]) {
      const data = await load(`wiki/meta/ledgers/${ledger}.json`);
      check(`知识账本为空 ${ledger}`, data && Object.keys(data.sources || {}).length === 0 && Object.keys(data.claims || {}).length === 0);
    }
  } catch { check("配置结构完整有效", false, "配置无法解析或字段类型无效。"); }
  for (const rel of files) {
    if (rel.endsWith(".md") && USER.some(folder => pathKey(rel).startsWith(pathKey(folder))) && !rel.endsWith(" Board.md")) {
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(texts[rel] || "");
      check(`用户目录示例标记 ${rel}`, frontmatter && /^\s*-\s*example\s*$/m.test(frontmatter[1]!));
    }
    if (rel.startsWith("01 Journal/Weekly/") && rel.endsWith(".md")) check(`周记名称属性 ${rel}`, /^week:\s*(\S+)/m.exec(texts[rel] || "")?.[1] === basename(rel, ".md"));
  }
  check("出生日期为空", /^birthdate:\s*$/m.test(texts["Meta/Compass Config.md"] || ""));
  check("人生主题使用发行默认值", texts["03 Planning/Life Theme.md"] === await readFile(join(SOURCE, "scripts/template/defaults/03 Planning/Life Theme.md"), "utf8"));
  check("核心价值使用发行默认值", texts["03 Planning/Core Values.md"] === await readFile(join(SOURCE, "scripts/template/defaults/03 Planning/Core Values.md"), "utf8"));
  check("知识操作日志为空", texts["wiki/log.md"] === await readFile(join(SOURCE, "scripts/template/defaults/wiki/log.md"), "utf8"));
  check("阅读计划无个人任务", !/^- \[ \]/m.test((texts["09 Reading/Reading Plan.md"] || "").replace(/```[\s\S]*?```/g, "")));
  for (const bad of ["wiki/concepts", "wiki/sources", "wiki/entities", "wiki/questions", ".vault-meta", ".raw", ".mcp.json", ".claude/settings.local.json", ".obsidian/plugins/agent-client/sessions", "Untitled.canvas", "08 Tasks/Untitled.base", "Guide/18 Distribution Checklist.md"]) check(`不包含 ${bad}`, !await present(bad));
  check("收件箱为空", !files.some(f => f.startsWith("inbox/") && !f.endsWith(".gitkeep")));
  if (texts[".obsidian/workspace.json"]) check("工作区打开设置页", texts[".obsidian/workspace.json"].includes("00 Dashboards/Setup.md"));
  for (const must of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".mcp.example.json", "LICENSE", "THIRD_PARTY_NOTICES.md", "CREDITS.md", "CHANGELOG.md", "Meta/version.md", "00 Dashboards/Setup.md", "Prompts/16 Onboarding Assistant.md"]) check(`包含 ${must}`, await present(must));
  check("助手文件导入 AGENTS.md", texts["CLAUDE.md"]?.includes("@AGENTS.md") && texts["GEMINI.md"]?.includes("@AGENTS.md"));
  const names = new Map(files.filter(f => f.endsWith(".md")).map(f => [basename(f, ".md"), f]));
  const unresolved = new Set<string>(), badFragments = new Set<string>(), missingMarkdown = new Set<string>();
  for (const [rel, text] of Object.entries(texts)) {
    if (!rel.endsWith(".md") || rel.startsWith("Guide/Source") || rel.startsWith("Templates/")) continue;
    const body = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "").replace(/<%[\s\S]*?%>/g, "");
    for (const match of body.matchAll(/\]\(([^\s)]+)\)/g)) {
      const target = match[1]!;
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#") || target.startsWith("//")) continue;
      try {
        const local = decodeURIComponent(target.split("#")[0]!);
        if (local && !files.includes(join(dirname(rel), local))) missingMarkdown.add(`${rel}: ${local}`);
      } catch { missingMarkdown.add(`${rel}: 无效链接编码`); }
    }
    for (const match of body.matchAll(/\[\[([^\]\|#]*)(?:#([^\]\|]*))?(?:\|[^\]]*)?\]\]/g)) {
      const target = match[1]!.trim().replace(/\/$/, ""), fragment = (match[2] || "").trim();
      const base = target ? target.split("/").at(-1)! : basename(rel, ".md");
      if (!names.has(base) && !DATE_LINK.test(base) && !base.endsWith(".base")) { unresolved.add(base); continue; }
      if (fragment && !fragment.startsWith("^") && names.has(base) && !new RegExp(`^#+\\s+${escape(fragment)}\\s*$`, "m").test(texts[names.get(base)!] || "")) badFragments.add(`${base}#${fragment}`);
    }
  }
  check("链接中的标题存在", !badFragments.size, [...badFragments].slice(0, 8).join(", "));
  check("Markdown 本地链接可解析", !missingMarkdown.size, [...missingMarkdown].slice(0, 8).join(", "));
  check("双向链接可解析（周期日期除外）", !unresolved.size, [...unresolved].slice(0, 8).join(", "));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const [rel, text] of Object.entries(texts)) if (rel.startsWith("Meta/views/") && rel.endsWith(".js")) {
    try { new AsyncFunction("dv", "input", "moment", "app", "Notice", text); check(`视图语法 ${rel}`, true); }
    catch { check(`视图语法 ${rel}`, false); }
  }
  for (const rel of ["Templates/Daily Note.md", "Templates/Personal Retreat.md"]) if (await present(rel)) {
    try {
      const template = texts[rel] || "";
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(template)?.[1];
      if (!frontmatter) throw new Error();
      const cfg = { questions: [{ key: "dq_a", text: "a" }, { key: "dq_b", text: "b" }], habits: ["habit_x"], wheel_areas: ["wheel_y", "wheel_z"] };
      for (const value of [cfg, null]) {
        const app = { vault: { getFileByPath: () => value ? {} : null }, metadataCache: { getFileCache: () => value ? { frontmatter: value } : null } };
        const tp = { date: { now: () => "2026-10-04" }, file: { title: rel.includes("Daily") ? "2026-10-04" : "2026-Q4 Personal Retreat" } };
        const output = frontmatter.replace(/<%\*([\s\S]*?)%>/g, (_match, code: string) =>
          new Function("app", "tp", "tR", `${code}; return tR;`)(app, tp, ""));
        const lines = output.split("\n").filter(line => /^(dq_|habit_|wheel_)/.test(line));
        const expected = rel.includes("Daily")
          ? value ? ["dq_a: ", "dq_b: ", "habit_x: false"] : ["dq_goals: ", "dq_progress: ", "dq_meaning: ", "dq_happy: ", "dq_relationships: ", "dq_engaged: ", "habit_journal: false", "habit_exercise: false", "habit_reading: false"]
          : value ? ["wheel_y: ", "wheel_z: "] : ["wheel_health: ", "wheel_relationships: ", "wheel_family: ", "wheel_career: ", "wheel_finances: ", "wheel_growth: ", "wheel_fun: ", "wheel_meaning: "];
        if (JSON.stringify(lines.sort()) !== JSON.stringify(expected.sort())) throw new Error();
      }
      check(`模板属性生成器 ${rel}`, true);
    } catch { check(`模板属性生成器 ${rel}`, false); }
  }
  let vaultBytes = 0, runtimeBytes = 0;
  for (const file of files) {
    const size = (await stat(join(root, file))).size;
    if (runtimeFiles.has(file)) runtimeBytes += size; else vaultBytes += size;
  }
  check("笔记库内容低于 20 MB", vaultBytes < 20e6, `${(vaultBytes / 1e6).toFixed(1)} MB`);
  check("独立 Pi 运行包低于 32 MB", runtimeBytes < 32e6, `${(runtimeBytes / 1e6).toFixed(1)} MB`);
  return results;
}
