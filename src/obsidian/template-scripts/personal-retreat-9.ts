// @host dataview
import type { App } from "obsidian";
import type { Templater, Dataview } from "./host";
declare const tp: Templater;
declare const app: App;
declare const dv: Dataview;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
declare let tR: string;
const q = moment(dv.current().quarter, "YYYY-[Q]Q");
const from = q.clone().startOf("quarter"), to = q.clone().endOf("quarter");
const cfg: { daily_folder?: string } = dv.page("系统/系统配置") || {};
const pages = dv.pages(`"${cfg.daily_folder || "01 日记/每日"}"`).where(p => /^\d{4}-\d{2}-\d{2}$/.test(p.file.name) && moment(p.file.name).isBetween(from, to, "day", "[]")).sort(p => p.file.name);
const wins = [];
for (const p of pages) for (const L of p.file.lists) if (L.section && ["Wins", "收获"].includes(L.section.subpath)) wins.push(`${p.file.link}: ${L.text}`);
if (wins.length) dv.list(wins); else dv.paragraph("*本季度尚未记录收获。*");
