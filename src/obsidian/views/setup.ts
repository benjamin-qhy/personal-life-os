import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Compass Setup status widget. Usage: await dv.view("系统/views/setup")
// Detects what is still at its template default. Renders booleans only; never shows key values; never writes.
const cfg: Partial<Page> = dv.page("系统/系统配置") || {};
const cur: Partial<Page> = dv.current() || {};
const rows: Array<{tier: number; item: string; ok: boolean; where: string; note: string}> = [];
const add = (tier: number, item: string, ok: boolean, where: string, note = "") => rows.push({ tier, item, ok, where, note: note || "" });
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const readJson = async (p: string): Promise<Record<string, unknown> | null> => {
  try { const value: unknown = JSON.parse(await app.vault.adapter.read(p)); return isRecord(value) ? value : null; }
  catch { return null; }
};
const readText = async (p: string) => { try { const f = app.vault.getFileByPath(p); return f ? await app.vault.cachedRead(f) : ""; } catch (e) { return ""; } };
const enabled = (id: string) => { try { return app.plugins.enabledPlugins.has(id); } catch (e) { return false; } };
const pset = (id: string) => { try { return app.plugins.plugins[id]?.settings || null; } catch (e) { return null; } };
const today = moment();

// 第 0 层：应用
for (const [id, name] of [["life-os-app", "Personal Life OS"], ["dataview", "Dataview"], ["templater-obsidian", "Templater"], ["periodic-notes", "Periodic Notes"], ["quickadd", "QuickAdd"], ["obsidian-tasks-plugin", "Tasks"], ["obsidian-kanban", "Kanban"]] as const)
  add(0, `已启用 ${name} 插件`, enabled(id), "设置 → 第三方插件");
add(0, "Personal Life OS 应用命令已注册", !!app.commands.findCommand("life-os-app:open-home"), "命令面板 → Personal Life OS：打开首页");
add(0, "Dataview JavaScript 查询已启用", !!(pset("dataview")?.enableDataviewJs), "设置 → Dataview");
add(0, "lifeos 样式片段已启用", (() => { try { return app.customCss.enabledSnippets.has("lifeos"); } catch (e) { return false; } })(), "设置 → 外观 → CSS 代码片段");
add(0, "Periodic Notes 日记目录与配置一致", (() => { const pn = pset("periodic-notes"); return !!pn && pn.daily?.folder === (cfg.daily_folder || "01 日记/每日") && /每日日记\.md$/.test(pn.daily?.template || ""); })(), "设置 → Periodic Notes");
add(0, "Templater 在新建文件时运行", (() => { const t = pset("templater-obsidian"); return !!t && (t.trigger_on_file_creation === true || t.trigger_on_file_creation_mode === "folder"); })(), "设置 → Templater");
add(0, "QuickAdd 捕获项已启用为命令", (() => { const ch = pset("quickadd")?.choices || []; return ["lifeos-journal", "lifeos-win", "lifeos-gratitude", "lifeos-task"].every(id => ch.find(c => c.id === id)?.command === true); })(), "设置 → QuickAdd（各项的闪电图标）");
add(0, "日记与每日问题的快捷键已设置", (() => { try { const hk = app.hotkeyManager.customKeys || {}; return ["quickadd:choice:lifeos-daily", "templater-obsidian:模板/每日问题评分.md"].every(id => (hk[id] || []).length > 0); } catch (e) { return false; } })(), "设置 → 快捷键");

// 第 1 层：个人设置
add(1, "已填写出生日期", !!cfg.birthdate && String(cfg.birthdate).slice(0, 10) !== "1990-01-01", "[[系统配置]]");
const theme = await readText("03 规划/人生主题.md");
add(1, "已填写人生主题", theme.length > 0 && !theme.includes("Replace this line with your life theme") && !theme.includes("请在这里填写你的人生主题"), "[[人生主题]]");
const values = await readText("03 规划/核心价值观.md");
add(1, "已填写核心价值观", values.length > 0 && !/\*\*(Value one|价值观一)\*\*/.test(values), "[[核心价值观]]");
add(1, "理想一周已定制（已移除 example 属性）", !((dv.page("03 规划/理想一周") || {}).example === true), "[[理想一周]]", "填写时间安排后移除 example 属性");
add(1, "已检查问题、习惯与人生领域", Array.isArray(cfg.questions) && cfg.questions.length > 0 && Array.isArray(cfg.habits) && cfg.habits.length <= 5, "[[系统配置]]", Array.isArray(cfg.habits) && cfg.habits.length > 5 ? "习惯超过 5 项，建议每阶段保留 3 至 5 项" : "");
const examples = dv.pages("#example").length;
add(1, "已移除示例笔记", examples === 0, "[[16 入门助手]] 第 6 步，或手动移除 example 示例", examples ? `还剩 ${examples} 篇示例笔记` : "");

// 第 2 层：日常实践
const daily = cfg.daily_folder || "01 日记/每日";
const dqp = cfg.dq_prefix || "dq_";
add(2, "今天的日记已创建", !!dv.page(`${daily}/${today.format("YYYY-MM-DD")}`), "Ctrl/Cmd+Shift+D");
const real = dv.pages(`"${daily}"`).where(p => /^\d{4}-\d{2}-\d{2}$/.test(p.file.name) && !(p.tags || []).includes("example")).array();
const answered = real.filter(p => Object.entries(p.file.frontmatter || {}).some(([k, v]) => k.startsWith(dqp) && v !== null && v !== "" && v !== undefined));
const last30 = answered.filter(p => today.diff(moment(p.file.name), "days") < 30).length;
add(2, "已完成首次真实每日问题记录", answered.length > 0, "今晚按 Ctrl/Cmd+Shift+Q，或使用 [[02 晚间回顾]]");
add(2, `最近 30 天的回答天数（目标 25 天）`, last30 >= 25, "继续记录", `${last30}/30`);
add(2, "本周笔记已创建", !!dv.page(`${cfg.weekly_folder || "01 日记/每周"}/${today.format("gggg-[W]ww")}`), "命令面板：Periodic Notes：打开周笔记", "从第 2 周开始");
add(2, "本季度静修笔记已创建", !!dv.page(`${cfg.retreat_folder || "02 静修"}/${today.format("YYYY-[Q]Q")} 个人静修`), "[[04 工作流 - 个人静修]]", "从第 60 天开始");
const plan = (await readText("09 阅读/阅读计划.md")).replace(/```[\s\S]*?```/g, "");
if (app.vault.getAbstractFileByPath("09 阅读")) add(2, "已决定是否启用阅读模块（填写计划或移除模块）", /^- \[ \]/m.test(plan), "[[07 工作流 - 每日阅读]]", "可选");

// 第 3 层：AI 辅助（可选）
add(3, "Agent Client 插件已启用", enabled("agent-client"), "设置 → 第三方插件", "可选");
const ac = await readJson(".obsidian/plugins/agent-client/data.json");
const agentDefinitions: unknown[] = [
  ...Object.values(isRecord(ac?.presetAgents) ? ac.presetAgents : {}),
  ...(Array.isArray(ac?.customAgents) ? ac.customAgents : []),
];
const configuredCommands = agentDefinitions.flatMap(agent =>
  isRecord(agent) && agent.enabled !== false && typeof agent.command === "string" && agent.command.trim()
    ? [agent.command.trim()] : []);
const isLinux = navigator.userAgent.includes("Linux") && !navigator.userAgent.includes("Android");
add(3, "Agent Client 已配置本地代理启动路径", configuredCommands.some(cmd => !isLinux || cmd.startsWith("/")), "设置 → Agent Client → 选择或添加代理", "可选；Linux Flatpak 使用启动器完整路径，参见指南 14");
add(3, "模型认证已配置（手动确认）", cur.setup_claude_login === true, "在本笔记属性中勾选 setup_claude_login", "可选；属性名称保留以兼容原工作流");
add(3, "可选 Obsidian MCP 已配置（手动确认）", cur.setup_mcp_registered === true, "参见 [[19 Obsidian MCP 桥接]]，完成后勾选 setup_mcp_registered", "可选");
add(3, "Agent Client 聊天已验收（手动确认）", cur.setup_agent_chat === true, "在本笔记属性中勾选 setup_agent_chat", "可选；用合成消息确认聊天与重启恢复，不自动读取历史");

// 第 4 层：浏览器与网络（可选）
add(4, "Local REST API 已启用", enabled("obsidian-local-rest-api"), "设置 → 第三方插件", "可选");
const ra = await readJson(".obsidian/plugins/obsidian-local-rest-api/data.json");
add(4, "REST API 密钥已生成（此处不显示）", typeof ra?.apiKey === "string" && ra.apiKey.length > 0 && ra?.enableInsecureServer === true, "设置 → Local REST API", "可选");
add(4, "Vault Lens 扩展已连接（手动确认）", cur.setup_vault_lens === true, "参见 [[17 搜索服务]]，完成后勾选 setup_vault_lens", "可选");
add(4, "网页查看器核心插件已启用", (() => { try { return app.internalPlugins.plugins.webviewer?.enabled === true; } catch (e) { return false; } })(), "设置 → 核心插件", "可选");
const seoDirectories = (await readJson(".obsidian/plugins/seo/data.json"))?.scanDirectories;
add(4, "SEO 扫描目录已设置", typeof seoDirectories === "string" && seoDirectories.includes("06 写作"), "设置 → SEO", "可选");
add(4, "已备份整个笔记库（手动确认）", cur.setup_backup === true, "将整个文件夹复制到其他位置后，勾选 setup_backup");

// Render
const root = dv.container.createEl("div", { cls: "lifeos-widget" });
if (cur.status === "done") { root.createEl("p", { text: "设置已标记完成。修改本笔记的 status 属性可重新打开检查清单。" }); }
else {
  const tiers: Record<number, string> = { 0: "第 0 层：应用", 1: "第 1 层：个人设置", 2: "第 2 层：日常实践", 3: "第 3 层：AI 辅助（可选）", 4: "第 4 层：浏览器与网络（可选）" };
  const total = rows.filter(r => r.tier <= 2).length, done = rows.filter(r => r.tier <= 2 && r.ok).length;
  root.createEl("p", { text: `必需项目已完成 ${done}/${total}。下方可选功能不影响笔记库的基本使用。` });
  for (const t of [0, 1, 2, 3, 4]) {
    root.createEl("h4", { text: tiers[t]! });
    const table = root.createEl("table", { cls: "lifeos-table" });
    const th = table.createEl("thead").createEl("tr"); for (const h of ["", "项目", "设置位置", "说明"]) th.createEl("th", { text: h });
    const tb = table.createEl("tbody");
    for (const r of rows.filter(x => x.tier === t)) {
      const tr = tb.createEl("tr");
      tr.createEl("td", { text: r.ok ? "✅" : "⬜" });
      tr.createEl("td", { text: r.item });
      const td = tr.createEl("td");
      const m = r.where.match(/^\[\[([^\]]+)\]\]/);
      if (m) { const a = td.createEl("a", { text: m[1]!, cls: "internal-link", attr: { href: m[1]!, "data-href": m[1]! } }); a.addEventListener("click", e => { e.preventDefault(); app.workspace.openLinkText(m[1]!, "", false); }); td.appendText(r.where.slice(m[0].length)); }
      else td.setText(r.where);
      tr.createEl("td", { text: r.note });
    }
  }
}
