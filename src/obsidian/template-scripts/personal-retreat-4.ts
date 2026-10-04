// @host expression
import type { App } from "obsidian";
import type { Templater, Dataview } from "./host";
declare const tp: Templater;
declare const app: App;
declare const dv: Dataview;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
declare let tR: string;
tR += String( moment(tp.file.title.slice(0, 7), "YYYY-[Q]Q").subtract(1, "quarter").format("YYYY-[Q]Q") );
