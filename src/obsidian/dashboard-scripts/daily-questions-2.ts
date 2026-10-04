import type { Dataview, Page } from "../views/host";
declare const dv: Dataview;
const cfg: Partial<Page> = dv.page("Meta/Compass Config") || {};
const folder = cfg.daily_folder || "01 Journal/Daily", pre = cfg.dq_prefix || "dq_";
const pages = dv.pages(`"${folder}"`).where(p => /^\d{4}-\d{2}-\d{2}$/.test(p.file.name)).sort(p => p.file.name, "desc").array();
const keys = [...new Set(pages.flatMap(p => Object.keys(p.file.frontmatter || {}).filter(k => k.startsWith(pre))))].sort();
const defaults: Readonly<Record<string, string>> = { goals: "明确目标", progress: "推进目标", meaning: "意义", happy: "快乐", relationships: "人际关系", engaged: "投入" };
const label = (key: string) => {
  const question = (cfg.questions || []).find(q => q !== null && typeof q === "object" && "key" in q && q.key === key);
  return question !== null && typeof question === "object" && "text" in question && typeof question.text === "string" ? question.text : defaults[key.slice(pre.length)] || key.slice(pre.length).replace(/[_-]+/g, " ");
};
const val = (p: Page, k: string) => { const v = (p.file.frontmatter || {})[k]; return v === null || v === undefined || v === "" ? "" : String(v); };
const rows = pages.filter(p => keys.some(k => val(p, k) !== "")).slice(0, 30).map(p => [p.file.link, ...keys.map(k => val(p, k))]);
if (keys.length) dv.table(["日期", ...keys.map(label)], rows); else dv.paragraph(`尚未找到 ${pre}* 属性。`);
