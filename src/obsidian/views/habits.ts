const labels: Record<string, string> = {"goals":"目标","progress":"进展","meaning":"意义","happy":"幸福","relationships":"关系","engaged":"投入","journal":"日记","exercise":"运动","reading":"阅读","health":"健康","family":"家庭","career":"事业","finances":"财务","growth":"成长","fun":"乐趣","focus":"专注"};
import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Compass Habit Canvas widget.
// Usage:  await dv.view("系统/views/habits", { days: 14 })
// Reads every daily note, finds checkbox properties starting with habit_prefix and
// renders: last N days grid, current streak, best streak, longest break, completion %, total.
const cfg: Partial<Page> = dv.page("系统/系统配置") || {};
const FOLDER = cfg.daily_folder || "01 日记/每日";
const PREFIX = cfg.habit_prefix || "habit_";
const DAYS = (input && input.days) || 14;

const isDaily = (n: string) => /^\d{4}-\d{2}-\d{2}$/.test(n);
const pages = dv.pages(`"${FOLDER}"`).where(p => isDaily(p.file.name)).array();
const byDate = new Map<string, Record<string, boolean>>();
const habits = new Set<string>();
for (const p of pages) {
  const fm = p.file.frontmatter || {};
  const vals: Record<string, boolean> = {};
  for (const k of Object.keys(fm)) {
    if (!k.startsWith(PREFIX)) continue;
    habits.add(k);
    vals[k] = fm[k] === true;
  }
  byDate.set(p.file.name, vals);
}

const root = dv.container.createEl("div", { cls: "lifeos-widget" });
if (habits.size === 0) {
  root.createEl("p", { text: `${FOLDER} 中暂无以 ${PREFIX} 开头的习惯属性。请在配置中添加习惯，并在每日记录中勾选。` });
} else {
  const today = moment().startOf("day");
  const fmt = (d: Moment) => d.format("YYYY-MM-DD");
  const label = (k: string) => labels[k.slice(PREFIX.length)] || k.slice(PREFIX.length).replace(/[_-]+/g, " ");
  const dates = [...byDate.keys()].sort();
  const first = moment(dates[0]);
  const rows = [];
  for (const h of [...habits].sort()) {
    const rec = (d: Moment) => byDate.get(fmt(d));
    const tracked = (d: Moment) => { const v = rec(d); return !!v && (h in v); };
    const done = (d: Moment) => { const v = rec(d); return !!v && v[h] === true; };

    // current streak: count back from today; if today is not done yet, start from yesterday
    let cur = 0;
    let d = today.clone();
    if (!done(d)) d.subtract(1, "day");
    while (done(d)) { cur++; d.subtract(1, "day"); }

    // best streak, longest break, totals (calendar days from first daily note to today)
    let best = 0, run = 0, brk = 0, gap = 0, total = 0, trackedDays = 0;
    for (let x = first.clone(); !x.isAfter(today); x.add(1, "day")) {
      if (tracked(x)) trackedDays++;
      if (done(x)) { total++; run++; if (run > best) best = run; if (gap > brk) brk = gap; gap = 0; }
      else if (tracked(x)) { run = 0; gap++; }   // tracked and missed: breaks the streak, extends the break
      else { run = 0; }                          // no daily note: breaks the streak, does not count as a break day
    }
    if (gap > brk) brk = gap;
    const pct = trackedDays ? Math.round(100 * total / trackedDays) : 0;

    const grid = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const x = today.clone().subtract(i, "day");
      grid.push(done(x) ? "●" : (tracked(x) ? "○" : "·"));
    }
    rows.push({ name: label(h), grid: grid.join(""), cur, best, brk, pct, total });
  }

  const table = root.createEl("table", { cls: "lifeos-table" });
  const thead = table.createEl("thead").createEl("tr");
  for (const h of ["习惯", `最近 ${DAYS} 天`, "当前连续", "最长连续", "最长中断", "完成率", "累计"]) thead.createEl("th", { text: h });
  const tbody = table.createEl("tbody");
  for (const r of rows) {
    const tr = tbody.createEl("tr");
    tr.createEl("td", { text: r.name });
    tr.createEl("td", { text: r.grid, cls: "lifeos-grid" });
    tr.createEl("td", { text: String(r.cur) });
    tr.createEl("td", { text: String(r.best) });
    tr.createEl("td", { text: String(r.brk) });
    tr.createEl("td", { text: r.pct + "%" });
    tr.createEl("td", { text: String(r.total) });
  }
  root.createEl("p", { text: "● 已完成   ○ 已记录但未完成   · 无日记", cls: "lifeos-legend" }).style.opacity = "0.6";
}
