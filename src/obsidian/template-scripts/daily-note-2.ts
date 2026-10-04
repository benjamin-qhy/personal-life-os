// @host templater
import type { App } from "obsidian";
import type { Templater, Dataview } from "./host";
declare const tp: Templater;
declare const app: App;
declare const dv: Dataview;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
declare let tR: string;
 const _cf = app.vault.getFileByPath("系统/系统配置.md"); const _cfg = _cf ? (app.metadataCache.getFileCache(_cf)?.frontmatter ?? {}) : {}; const _qs = Array.isArray(_cfg.questions) && _cfg.questions.length ? _cfg.questions.map(q => (q && q.key) ? q.key : q).filter(Boolean) : ["dq_goals","dq_progress","dq_meaning","dq_happy","dq_relationships","dq_engaged"]; const _hs = Array.isArray(_cfg.habits) && _cfg.habits.length ? _cfg.habits : ["habit_journal","habit_exercise","habit_reading"]; tR += _qs.map(k => k + ": ").join("\n") + "\n" + _hs.map(k => k + ": false").join("\n");
