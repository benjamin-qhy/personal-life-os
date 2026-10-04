import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Compass Memento Mori widget. Usage: await dv.view("系统/views/memento")
// Reads birthdate and life_expectancy from 系统/系统配置.
const cfg: Partial<Page> = dv.page("系统/系统配置") || {};
const root = dv.container.createEl("div", { cls: "lifeos-widget" });
if (!cfg.birthdate) {
  root.createEl("p", { text: "请在配置中填写出生日期 birthdate（YYYY-MM-DD）和预期寿命 life_expectancy，以显示人生时间。" });
} else {
  const birth = moment(String(cfg.birthdate).slice(0, 10));
  const years = Number(cfg.life_expectancy) || 80;
  const today = moment().startOf("day");
  const weeksLived = today.diff(birth, "weeks");
  const totalWeeks = Math.round(years * 52.1775);
  const weeksLeft = Math.max(0, totalWeeks - weeksLived);
  const pct = Math.min(100, Math.round(1000 * weeksLived / totalWeeks) / 10);
  const age = today.diff(birth, "years");
  root.createEl("p", { text: `你现在 ${age} 岁，已度过约 ${weeksLived.toLocaleString()} 周。按 ${years} 岁估算，还剩约 ${weeksLeft.toLocaleString()} 周（已度过 ${pct}%）。` });
  const bar = root.createEl("div", { cls: "lifeos-bar" });
  bar.createEl("div").style.width = pct + "%";
  const grid = root.createEl("div", { cls: "lifeos-years" });
  grid.style.marginTop = "0.5em";
  for (let y = 0; y < years; y++) {
    const s = grid.createEl("span");
    if (y < age) s.addClass("lived");
    if (y === age) s.addClass("now");
    s.title = `${y} 岁`;
  }
  root.createEl("p", { text: "每格代表一年。认真安排接下来的一年。" }).style.opacity = "0.6";
}
