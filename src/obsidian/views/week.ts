const labels: Record<string, string> = {"goals":"目标","progress":"进展","meaning":"意义","happy":"幸福","relationships":"关系","engaged":"投入","journal":"日记","exercise":"运动","reading":"阅读","health":"健康","family":"家庭","career":"事业","finances":"财务","growth":"成长","fun":"乐趣","focus":"专注"};
import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Compass weekly review table: one row per day of the week with daily-question scores and habit hits.
// Usage: await dv.view("Meta/views/week", { week: dv.current().file.name })   // file named gggg-[W]ww
const cfg: Partial<Page> = dv.page("Meta/Compass Config") || {};
const FOLDER = cfg.daily_folder || "01 Journal/Daily";
const DQ = cfg.dq_prefix || "dq_";
const HB = cfg.habit_prefix || "habit_";
const weekName = (input && input.week) || moment().format("gggg-[W]ww");
const start = moment(weekName, "gggg-[W]ww").startOf("week");
const label = (k: string, pre: string) => labels[k.slice(pre.length)] || k.slice(pre.length).replace(/[_-]+/g, " ");

const days = [];
for (let i = 0; i < 7; i++) days.push(start.clone().add(i, "day"));
const pagesByName = new Map(dv.pages(`"${FOLDER}"`).array().map(p => [p.file.name, p]));
const dqKeys = new Set<string>(), hbKeys = new Set<string>();
for (const d of days) {
  const p = pagesByName.get(d.format("YYYY-MM-DD"));
  if (!p) continue;
  for (const k of Object.keys(p.file.frontmatter || {})) { if (k.startsWith(DQ)) dqKeys.add(k); if (k.startsWith(HB)) hbKeys.add(k); }
}
const dqs = [...dqKeys].sort(), hbs = [...hbKeys].sort();
const header = ["日期", ...dqs.map(k => label(k, DQ)), "习惯"];
const rows = [];
const sums: Record<string, number> = {}, counts: Record<string, number> = {};
for (const d of days) {
  const name = d.format("YYYY-MM-DD");
  const p = pagesByName.get(name);
  const fm = p ? (p.file.frontmatter || {}) : null;
  const cells = [p ? dv.fileLink(p.file.path, false, d.format("M月D日")) : d.format("M月D日")];
  for (const k of dqs) {
    const raw = fm?.[k];
    const v = typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw <= 10 ? raw : null;
    if (v !== null) { sums[k] = (sums[k] || 0) + v; counts[k] = (counts[k] || 0) + 1; }
    cells.push(v === null ? "" : String(v));
  }
  const hit = fm ? hbs.filter(k => fm[k] === true).length : 0;
  cells.push(fm ? `${hit}/${hbs.length}` : "");
  rows.push(cells);
}
rows.push(["**平均**", ...dqs.map(k => counts[k] ? (sums[k]! / counts[k]!).toFixed(1) : ""), ""]);
if (dqs.length === 0 && hbs.length === 0) dv.paragraph(`${weekName} 暂无包含 ${DQ}* 或 ${HB}* 属性的日记。`);
else dv.table(header, rows);
