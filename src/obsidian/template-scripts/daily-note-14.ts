// @host dataview
import type { App } from "obsidian";
import type { Templater, Dataview } from "./host";
declare const tp: Templater;
declare const app: App;
declare const dv: Dataview;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
declare let tR: string;
const me = dv.current().file.name;
const cfg: { daily_folder?: string } = dv.page("Meta/Compass Config") || {};
const folder = cfg.daily_folder || "01 Journal/Daily";
if (/^\d{4}-\d{2}-\d{2}$/.test(me)) {
  const mmdd = me.slice(4);
  const yr = parseInt(me.slice(0, 4));
  const hits = dv.pages(`"${folder}"`).where(p => /^\d{4}-\d{2}-\d{2}$/.test(p.file.name) && Number(p.file.name.slice(0, 4)) < yr && p.file.name.endsWith(mmdd)).sort(p => p.file.name, "desc");
  if (hits.length === 0) dv.paragraph("*往年这一天暂无记录。留下一点未来会感谢自己的记忆吧。*");
  for (const p of hits) {
    const n = yr - parseInt(p.file.name.slice(0, 4));
    dv.header(4, `${n} 年前：${p.file.link}`);
    const file = app.vault.getFileByPath(p.file.path);
    const headings = file ? app.metadataCache.getFileCache(file)?.headings || [] : [];
    const journal = headings.find(h => h.level === 2 && h.heading === "日记") || headings.find(h => h.level === 2 && h.heading === "Journal");
    if (journal) dv.paragraph(`![[${p.file.path.replace(/\.md$/, "")}#${journal.heading}]]`);
    else dv.paragraph("*未找到日记章节或其元数据尚未就绪，请打开原笔记查看。*");
  }
}
