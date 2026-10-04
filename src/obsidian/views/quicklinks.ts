import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Compass quick links: capture buttons (QuickAdd commands) + jump to today's multi-scale planning notes.
// Usage: await dv.view("Meta/views/quicklinks")
const cfg: Partial<Page> = dv.page("Meta/Compass Config") || {};
const DAILY = cfg.daily_folder || "01 Journal/Daily";
const WEEKLY = cfg.weekly_folder || "01 Journal/Weekly";
const QUARTERLY = cfg.quarterly_folder || "01 Journal/Quarterly";
const RETREATS = cfg.retreat_folder || "02 Retreats";
const root = dv.container.createEl("div", { cls: "lifeos-widget" });

const now = moment();
const links: Array<[string, string, string]> = [
  ["今天", `${DAILY}/${now.format("YYYY-MM-DD")}`, now.format("YYYY-MM-DD")],
  ["本周", `${WEEKLY}/${now.format("gggg-[W]ww")}`, now.format("gggg-[W]ww")],
  ["本季度", `${QUARTERLY}/${now.format("YYYY-[Q]Q")}`, now.format("YYYY-[Q]Q")],
  ["个人静修", `${RETREATS}/${now.format("YYYY-[Q]Q")} Personal Retreat`, `${now.format("YYYY-[Q]Q")} Personal Retreat`],
];
const p = root.createEl("p");
p.appendText("跳转：");
links.forEach(([lab, path, name], i) => {
  if (i) p.appendText("  ·  ");
  const a = p.createEl("a", { text: `${lab} (${name})`, cls: "internal-link", attr: { href: name, "data-href": name } });
  a.addEventListener("click", e => { e.preventDefault(); app.workspace.openLinkText(name, path, false); });
});

// Buttons resolve the QuickAdd choice by NAME at click time, so ids may change freely.
const buttons: Array<[string, string, string]> = [
  ["📝 记录日记", "Journal entry", "lifeos-journal"],
  ["🏆 记录收获", "Log a win", "lifeos-win"],
  ["🙏 感恩", "Gratitude", "lifeos-gratitude"],
  ["✅ 添加任务", "Add task", "lifeos-task"],
];
const wrap = root.createEl("div", { cls: "lifeos-buttons" });
for (const [lab, name, fallbackId] of buttons) {
  const b = wrap.createEl("button", { text: lab });
  b.addEventListener("click", () => {
    const qa = app.plugins?.plugins?.quickadd;
    const choice = qa?.settings?.choices?.find(c => (c.name || "").includes(name));
    const id = `quickadd:choice:${choice ? choice.id : fallbackId}`;
    const ok = app.commands.executeCommandById(id);
    if (!ok) new Notice(`未找到 QuickAdd 捕获项“${name}”，或它尚未启用为命令。请检查 QuickAdd 设置。`);
  });
}
