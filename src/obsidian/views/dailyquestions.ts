const labels: Record<string, string> = {"goals":"目标","progress":"进展","meaning":"意义","happy":"幸福","relationships":"关系","engaged":"投入","journal":"日记","exercise":"运动","reading":"阅读","health":"健康","family":"家庭","career":"事业","finances":"财务","growth":"成长","fun":"乐趣","focus":"专注"};
import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Compass Daily Questions widget: lines + averages of every dq_* number property.
// Usage:
//   await dv.view("Meta/views/dailyquestions", { days: 30 })              interactive (dropdown + toggles)
//   await dv.view("Meta/views/dailyquestions", { from: "2026-07-01", to: "2026-09-30" })  fixed range
const escapeText = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const cfg: Partial<Page> = dv.page("Meta/Compass Config") || {};
const FOLDER = cfg.daily_folder || "01 Journal/Daily";
const PREFIX = cfg.dq_prefix || "dq_";
const DEFAULT_RANGE = (input && input.days) || 30;
const FIXED_FROM = input && input.from ? moment(input.from) : null;
const FIXED_TO = input && input.to ? moment(input.to) : null;
const COLORS = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#9a6324", "#469990", "#800000"];

const pages = dv.pages(`"${FOLDER}"`).where(p => /^\d{4}-\d{2}-\d{2}$/.test(p.file.name)).array();
const series: Record<string, Array<{ date: string; t: number; v: number }>> = {};
for (const p of pages) {
  const fm = p.file.frontmatter || {};
  for (const k of Object.keys(fm)) {
    if (!k.startsWith(PREFIX)) continue;
    const v = fm[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 1 || v > 10) continue;
    (series[k] ||= []).push({ date: p.file.name, t: moment(p.file.name).valueOf(), v });
  }
}
const keys = Object.keys(series).sort();
const label = (k: string) => labels[k.slice(PREFIX.length)] || k.slice(PREFIX.length).replace(/[_-]+/g, " ");

const root = dv.container.createEl("div", { cls: "lifeos-widget" });
if (keys.length === 0) {
  root.createEl("p", { text: `${FOLDER} 中暂无以 ${PREFIX} 开头的数值属性。完成每日问题后，这里会显示记录。` });
} else {
  const controls = root.createEl("div", { cls: "lifeos-controls" });
  let sel: HTMLSelectElement | null = null;
  if (!FIXED_FROM) {
    sel = controls.createEl("select");
    for (const [v, l] of [[7, "最近 7 天"], [30, "最近 30 天"], [90, "最近 90 天"], [365, "最近一年"], [0, "全部时间"]] as const) {
      const o = sel.createEl("option", { text: l });
      o.value = String(v);
      if (v === DEFAULT_RANGE) o.selected = true;
    }
    sel.addEventListener("change", render);
  } else {
    controls.createEl("span", { text: `${FIXED_FROM.format("YYYY-MM-DD")} → ${FIXED_TO ? FIXED_TO.format("YYYY-MM-DD") : "今天"}` });
  }
  const toggles: Record<string, HTMLInputElement> = {};
  keys.forEach((k, i) => {
    const lab = controls.createEl("label");
    const cb = lab.createEl("input", { attr: { type: "checkbox" } });
    cb.checked = true;
    lab.appendText(" " + label(k));
    lab.style.color = COLORS[i % COLORS.length]!;
    toggles[k] = cb;
    cb.addEventListener("change", render);
  });
  const chart = root.createEl("div", { cls: "lifeos-chart" });
  const tableEl = root.createEl("div");

  function render() {
    const today = moment().startOf("day");
    let from, to = FIXED_TO ? FIXED_TO.clone().endOf("day") : today.clone().endOf("day");
    if (FIXED_FROM) from = FIXED_FROM.clone().startOf("day");
    else {
      const days = Number(sel?.value ?? DEFAULT_RANGE);
      if (days > 0) from = today.clone().subtract(days - 1, "day");
      else { const all = keys.flatMap(k => series[k]!.map(x => x.t)); from = moment(Math.min(...all)).startOf("day"); }
    }
    const t0 = from.valueOf(), t1 = to.valueOf();
    const W = 720, H = 260, ml = 32, mr = 12, mt = 12, mb = 28;
    const iw = W - ml - mr, ih = H - mt - mb;
    const x = (t: number) => t1 === t0 ? ml + iw / 2 : ml + (t - t0) / (t1 - t0) * iw;
    const y = (v: number) => mt + (10 - v) / 9 * ih;
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    for (let g = 1; g <= 10; g++) {
      svg += `<line x1="${ml}" x2="${W - mr}" y1="${y(g)}" y2="${y(g)}" stroke="currentColor" stroke-opacity="${g === 1 || g === 10 ? 0.35 : 0.12}" />`;
      if (g === 1 || g === 5 || g === 10) svg += `<text x="${ml - 6}" y="${y(g) + 4}" font-size="11" text-anchor="end" fill="currentColor" opacity="0.7">${g}</text>`;
    }
    svg += `<text x="${ml}" y="${H - 8}" font-size="11" fill="currentColor" opacity="0.7">${from.format("YYYY年M月D日")}</text>`;
    svg += `<text x="${W - mr}" y="${H - 8}" font-size="11" text-anchor="end" fill="currentColor" opacity="0.7">${to.format("YYYY年M月D日")}</text>`;
    const rows: Array<Array<string | number | undefined>> = [];
    keys.forEach((k, i) => {
      if (!toggles[k]!.checked) return;
      const pts = series[k]!.filter(p => p.t >= t0 && p.t <= t1).sort((a, b) => a.t - b.t);
      if (pts.length === 0) { rows.push([label(k), "-", "-", "-", 0, "-"]); return; }
      const color = COLORS[i % COLORS.length]!;
      const poly = pts.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
      svg += `<polyline points="${poly}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`;
      for (const p of pts) svg += `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.5" fill="${color}"><title>${p.date}: ${p.v}</title></circle>`;
      const vals = pts.map(p => p.v);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      svg += `<line x1="${ml}" x2="${W - mr}" y1="${y(avg)}" y2="${y(avg)}" stroke="${color}" stroke-opacity="0.35" stroke-dasharray="4 4" />`;
      rows.push([label(k), avg.toFixed(1), Math.min(...vals), Math.max(...vals), vals.length, vals[vals.length - 1]]);
    });
    svg += `</svg>`;
    chart.innerHTML = svg;
    let html = `<table class="lifeos-table"><thead><tr><th>问题</th><th>平均</th><th>最低</th><th>最高</th><th>回答天数</th><th>最近</th></tr></thead><tbody>`;
    for (const r of rows) html += `<tr>${r.map(c => `<td>${escapeText(c)}</td>`).join("")}</tr>`;
    html += `</tbody></table>`;
    tableEl.innerHTML = html;
  }
  render();
}
