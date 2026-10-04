// @host expression
import type { App } from "obsidian";
import type { Templater, Dataview } from "./host";
declare const tp: Templater;
declare const app: App;
declare const dv: Dataview;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
declare let tR: string;
tR += String( tp.date.now("YYYY年M月D日", 0, tp.file.title, "YYYY-MM-DD") );
