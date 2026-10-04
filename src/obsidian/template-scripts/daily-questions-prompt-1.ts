// @host templater-trim
import type { App } from "obsidian";
import type { Templater, Dataview } from "./host";
declare const tp: Templater;
declare const app: App;
declare const dv: Dataview;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
declare let tR: string;

/*
  Compass: end-of-day Daily Questions prompt (Marshall Goldsmith, "Triggers").
  Run this template ON the daily note (Templater: Open insert template modal, or the hotkey you assign).
  It asks each question, expects 1..10, then asks yes/no for every habit_* property,
  and writes the answers into the note's properties. Nothing is inserted into the body.
  Questions come from the `questions` list in 系统/系统配置.md (FALLBACK below is used only if that list is missing). Keep the "Did I do my best to" framing:
  grade effort, not results.
*/
const FALLBACK = [
  ["dq_goals",         "今天我是否尽力设定了清晰的目标？"],
  ["dq_progress",      "今天我是否尽力推动目标取得进展？"],
  ["dq_meaning",       "今天我是否尽力寻找意义？"],
  ["dq_happy",         "今天我是否尽力让自己感到幸福？"],
  ["dq_relationships", "今天我是否尽力建立积极的关系？"],
  ["dq_engaged",       "今天我是否尽力全心投入？"],
];
const file = tp.config.target_file;
const cache = app.metadataCache.getFileCache(file) || {};
const fm = cache.frontmatter || {};
const configFile = app.vault.getFileByPath("系统/系统配置.md");
const cfg = (configFile && app.metadataCache.getFileCache(configFile)?.frontmatter) || {};
const HB = cfg.habit_prefix || "habit_";
const QUESTIONS = Array.isArray(cfg.questions) && cfg.questions.length ? cfg.questions.map(q => typeof q === "string" ? [q, "今天我是否尽力：" + q.replace(/^dq_/, "").replace(/[_-]+/g, " ") + "?"] : [q.key, q.text]).filter(x => x[0] && x[1]) : FALLBACK;
const answers: Record<string, number | boolean> = {};
let cancelled = false;
for (const [key, q] of QUESTIONS) {
  const a = await tp.system.prompt(`${q}  （1 至 10 分，仅评价努力程度）`, fm[key] ? String(fm[key]) : "");
  if (a === null) { cancelled = true; break; }
  const n = parseInt(a);
  if (!isNaN(n)) answers[key] = Math.min(10, Math.max(1, n));
}
if (!cancelled) {
  const habits = Object.keys(fm).filter(k => k.startsWith(HB));
  for (const h of habits) {
    const names: Record<string, string> = { journal: "日记", exercise: "运动", reading: "阅读" };
    const nice = names[h.slice(HB.length)] || h.slice(HB.length).replace(/[_-]+/g, " ");
    const pick = await tp.system.suggester(["是", "否"], [true, false], false, `习惯：${nice}，完成了吗？`);
    if (pick === null) break;
    answers[h] = pick;
  }
}
if (Object.keys(answers).length) {
  await app.fileManager.processFrontMatter(file, f => { Object.assign(f, answers); });
  new Notice(`已将 ${Object.keys(answers).length} 项回答保存到 ${file.basename}`);
}
