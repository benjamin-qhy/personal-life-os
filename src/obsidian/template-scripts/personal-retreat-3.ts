// @host templater
import type { App } from "obsidian";
import type { Templater, Dataview } from "./host";
declare const tp: Templater;
declare const app: App;
declare const dv: Dataview;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
declare let tR: string;
 const _cf = app.vault.getFileByPath("Meta/Compass Config.md"); const _cfg = _cf ? (app.metadataCache.getFileCache(_cf)?.frontmatter ?? {}) : {}; const _ws = Array.isArray(_cfg.wheel_areas) && _cfg.wheel_areas.length ? _cfg.wheel_areas : ["wheel_health","wheel_relationships","wheel_family","wheel_career","wheel_finances","wheel_growth","wheel_fun","wheel_meaning"]; tR += _ws.map(k => k + ": ").join("\n");
