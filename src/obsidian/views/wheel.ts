const labels: Record<string, string> = {"goals":"目标","progress":"进展","meaning":"意义","happy":"幸福","relationships":"关系","engaged":"投入","journal":"日记","exercise":"运动","reading":"阅读","health":"健康","family":"家庭","career":"事业","finances":"财务","growth":"成长","fun":"乐趣","focus":"专注"};
import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Compass Wheel of Life widget: radar chart from wheel_* number properties.
// Usage:
//   await dv.view("系统/views/wheel")                                  -> this quarter's retreat (by naming convention), else most recent
//   await dv.view("系统/views/wheel", { page: dv.current().file.path })  -> a specific retreat note (used inside the retreat template)
const escapeText = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const cfg: Partial<Page> = dv.page("系统/系统配置") || {};
const FOLDER = cfg.retreat_folder || "02 静修";
const PREFIX = cfg.wheel_prefix || "wheel_";

let page = input && input.page ? dv.page(input.page) : null;
let how = "";
if (!page) {
  const q = moment().quarter(), yr = moment().year();
  page = dv.page(`${FOLDER}/${yr}-Q${q} 个人静修`);
  how = page ? `本季度（${yr}-Q${q}）` : "";
}
if (!page) {
  const all = dv.pages(`"${FOLDER}"`).where(p => /^\d{4}-Q[1-4] 个人静修$/.test(p.file.name)).sort(p => p.file.name, "desc").array();
  page = all[0];
  how = page ? "最近一次静修" : "";
}

const root = dv.container.createEl("div", { cls: "lifeos-widget" });
if (!page) {
  root.createEl("p", { text: `${FOLDER} 中暂无静修笔记。请创建名为 YYYY-QN 个人静修 的笔记，并填写 ${PREFIX}* 属性。` });
} else {
  const fm = page.file.frontmatter || {};
  const axes = Object.keys(fm)
    .filter(k => k.startsWith(PREFIX) && typeof fm[k] === "number" && Number.isFinite(fm[k]) && fm[k] >= 1 && fm[k] <= 10)
    .map(k => ({ key: k, name: labels[k.slice(PREFIX.length)] || k.slice(PREFIX.length).replace(/[_-]+/g, " "), v: fm[k] as number }));
  if (how) root.createEl("p", { text: `来源：${page.file.name}（${how}）` }).style.opacity = "0.7";
  if (axes.length < 3) {
    root.createEl("p", { text: `静修笔记 ${page.file.name} 填写的 ${PREFIX}* 属性不足 3 项。` });
  } else {
    const n = axes.length, cx = 170, cy = 160, R = 105, W = 340, H = 320;
    const ang = (i: number) => -Math.PI / 2 + i * 2 * Math.PI / n;
    const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:${W}px">`;
    for (const ring of [2, 4, 6, 8, 10]) {
      const pts = axes.map((_, i) => pt(i, R * ring / 10).map(c => c.toFixed(1)).join(",")).join(" ");
      svg += `<polygon points="${pts}" fill="none" stroke="currentColor" stroke-opacity="${ring === 10 ? 0.4 : 0.15}" />`;
    }
    axes.forEach((a, i) => {
      const [x2, y2] = pt(i, R);
      svg += `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-opacity="0.2" />`;
      const [lx, ly] = pt(i, R + 22);
      const anchor = Math.abs(lx - cx) < 5 ? "middle" : (lx > cx ? "start" : "end");
      svg += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" font-size="11" text-anchor="${anchor}" fill="currentColor">${escapeText(a.name)} (${a.v})</text>`;
    });
    const poly = axes.map((a, i) => pt(i, R * a.v / 10).map(c => c.toFixed(1)).join(",")).join(" ");
    svg += `<polygon points="${poly}" fill="var(--interactive-accent)" fill-opacity="0.35" stroke="var(--interactive-accent)" stroke-width="2" />`;
    axes.forEach((a, i) => { const [px, py] = pt(i, R * a.v / 10); svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="var(--interactive-accent)" />`; });
    svg += `</svg>`;
    root.createEl("div", { cls: "lifeos-chart" }).innerHTML = svg;
    const avg = axes.reduce((s, a) => s + a.v, 0) / n;
    const low = [...axes].sort((a, b) => a.v - b.v)[0]!;
    root.createEl("p", { text: `平均 ${avg.toFixed(1)} / 10。当前最低领域：${low.name}（${low.v}）。可考虑在未来 90 天重点关注。` });
  }
}
