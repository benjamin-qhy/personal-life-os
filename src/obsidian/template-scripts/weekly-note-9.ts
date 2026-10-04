// @host templater
import type { App } from "obsidian";
import type { Templater, Dataview } from "./host";
declare const tp: Templater;
declare const app: App;
declare const dv: Dataview;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
declare let tR: string;
 const s = moment(tp.file.title, "gggg-[W]ww").startOf("week"); const parts = []; for (let i = 0; i < 7; i++) parts.push(`[[01 日记/每日/${s.clone().add(i, "day").format("YYYY-MM-DD")}|${s.clone().add(i, "day").format("M月D日")}]]`); tR += parts.join(" · ");
