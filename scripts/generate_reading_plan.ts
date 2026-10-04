#!/usr/bin/env bun
import { parseArgs } from "node:util";

import { READING_BOOKS, chineseBookName } from "./reading-books";

const CHRONOLOGICAL_BOOKS: string[] = [
  "Genesis",
  "Job",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Chronicles",
  "Psalms",
  "2 Chronicles",
  "1 Kings",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "2 Kings",
  "Obadiah",
  "Joel",
  "Jonah",
  "Amos",
  "Hosea",
  "Micah",
  "Isaiah",
  "Nahum",
  "Zephaniah",
  "Habakkuk",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Ezra",
  "Haggai",
  "Zechariah",
  "Esther",
  "Nehemiah",
  "Malachi",
  "Luke",
  "Mark",
  "Matthew",
  "John",
  "Acts",
  "James",
  "Galatians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Corinthians",
  "2 Corinthians",
  "Romans",
  "Ephesians",
  "Philippians",
  "Colossians",
  "Philemon",
  "1 Timothy",
  "Titus",
  "1 Peter",
  "2 Timothy",
  "2 Peter",
  "Hebrews",
  "Jude",
  "1 John",
  "2 John",
  "3 John",
  "Revelation"
];

function main() {
  const { values } = parseArgs({ options: {
    start: { type: "string" }, days: { type: "string", default: "365" },
    order: { type: "string", default: "canonical" },
    "skip-weekday": { type: "string", multiple: true, default: [] },
    help: { type: "boolean", short: "h" },
  } });
  if (values.help) {
    console.log("用法：bun scripts/generate_reading_plan.ts --start YYYY-MM-DD [--days 365] [--order canonical|chronological] [--skip-weekday 0]\n星期编号：0 为周一，6 为周日，可重复指定。输出到标准输出。"); return;
  }
  const start = values.start;
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error("--start 必须为 YYYY-MM-DD");
  const date = new Date(`${start}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start) throw new Error("开始日期无效");
  const count = Number(values.days);
  if (!/^\d+$/.test(values.days) || !Number.isSafeInteger(count) || count <= 0) throw new Error("--days 必须为正整数");
  if (!["canonical", "chronological"].includes(values.order)) throw new Error("--order 必须为 canonical 或 chronological");
  const skipped = new Set(values["skip-weekday"].map(value => {
    if (!/^[0-6]$/.test(value)) throw new Error("--skip-weekday 必须在 0 到 6 之间");
    return Number(value);
  }));
  if (skipped.size === 7) throw new Error("不能跳过一周的全部日期");
  // Calendar arithmetic uses UTC, so daylight-saving changes do not alter scheduled dates.
  const dates: string[] = [];
  while (dates.length < count) {
    if (date.getUTCFullYear() > 9999) throw new Error("阅读计划超出支持的日期范围");
    if (!skipped.has((date.getUTCDay() + 6) % 7)) dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const counts = new Map(READING_BOOKS.map(([english, , chapters]) => [english, chapters]));
  const names = values.order === "canonical" ? READING_BOOKS.map(([name]) => name) : CHRONOLOGICAL_BOOKS;
  const chapters = names.flatMap(name => Array.from({ length: counts.get(name)! }, (_, i) => `${chineseBookName(name)} ${i + 1}`));
  const perDay = chapters.length / count;
  const output = ["---", "tags:", "  - bible", `plan: ${values.order}`, `start: ${start}`, `days: ${count}`, "---", "# 圣经阅读计划", "", `${chapters.length} 章，分为 ${count} 个阅读日（每天约 ${perDay.toFixed(2)} 章），${values.order === "canonical" ? "正典顺序" : "大致年代顺序"}。由 scripts/generate_reading_plan.ts 生成。`, "", "## 阅读安排"];
  for (const [i, chapter] of chapters.entries()) output.push(`- [ ] 阅读 [[${chapter}]] ⏳ ${dates[Math.min(Math.floor(i / perDay), count - 1)]}`);
  console.log(output.join("\n"));
}
try { main(); } catch (error) { console.error(`错误：${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
