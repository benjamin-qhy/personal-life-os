#!/usr/bin/env bun
/** 将每行「书名 章:节<TAB>正文」拆成章节和经节笔记。已有文件会覆盖。 */
import { parseArgs } from "node:util";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: "string", default: "09 Reading" }, books: { type: "string", default: "" },
    translation: { type: "string", default: "KJV" }, help: { type: "boolean", short: "h" },
  } });
  if (values.help) { console.log('用法：bun scripts/split_bible.ts source.txt [--out "09 Reading"] [--books "Genesis,John"] [--translation KJV]\n每行格式：书名 章:节<TAB>正文。支持中文书名，已有文件会覆盖。'); return; }
  if (positionals.length !== 1) throw new Error("必须提供一个源文本文件");
  const only = new Set(values.books.split(",").map(x => x.trim()).filter(Boolean));
  const data = new Map<string, Map<number, Map<number, string>>>();
  for (const raw of readFileSync(positionals[0]!, "utf8").split(/\r?\n/)) {
    // A restricted Unicode name alphabet supports Chinese while excluding path and wikilink syntax.
    const m = raw.match(/^([1-3]?\s?[\p{L}\p{M} ]+?)\s+(\d+):(\d+)\t(.+)$/u);
    if (!m) continue;
    const book = m[1]!.trim(), ch = Number(m[2]), verse = Number(m[3]);
    if (only.size && !only.has(book)) continue;
    if (!Number.isSafeInteger(ch) || !Number.isSafeInteger(verse) || ch < 1 || verse < 1) continue;
    if (!data.has(book)) data.set(book, new Map());
    const chapters = data.get(book)!;
    if (!chapters.has(ch)) chapters.set(ch, new Map());
    chapters.get(ch)!.set(verse, m[4]!.trim());
  }
  const chapDir = join(values.out, "Chapters"), verseDir = join(values.out, "Verses");
  mkdirSync(chapDir, { recursive: true }); mkdirSync(verseDir, { recursive: true });
  let nCh = 0, nV = 0;
  for (const [book, chapters] of data) for (const [ch, verses] of chapters) {
    const name = `${book} ${ch}`;
    const nav = [ch > 1 ? `上一章：[[${book} ${ch - 1}]]` : "", chapters.has(ch + 1) ? `下一章：[[${book} ${ch + 1}]]` : ""].filter(Boolean).join(" · ");
    const frontmatter = [`book: ${JSON.stringify(book)}`, `chapter: ${ch}`, `translation: ${JSON.stringify(values.translation)}`];
    const body = ["---", "type: bible-chapter", ...frontmatter, "tags:", "  - bible/chapter", "---", `# ${name}`, "", nav, "", "## 正文", ...[...verses].map(([v, text]) => `${v}. ${text}`), "", "## 经节", [...verses.keys()].map(v => `[[${book} ${ch}.${v}]]`).join(" · "), "", "## 引用本章的笔记与讲道", "```dataview", "LIST", 'WHERE contains(file.outlinks, this.file.link) AND file.folder != this.file.folder', "```", ""];
    writeFileSync(join(chapDir, `${name}.md`), body.join("\n")); nCh++;
    const keys = [...verses.keys()];
    for (const [i, v] of keys.entries()) {
      const links = [`章节：[[${name}]]`];
      if (i > 0) links.push(`上一节：[[${book} ${ch}.${keys[i - 1]}]]`);
      if (i + 1 < keys.length) links.push(`下一节：[[${book} ${ch}.${keys[i + 1]}]]`);
      const body = ["---", "type: bible-verse", ...frontmatter, `verse: ${v}`, "tags:", "  - bible/verse", "---", `# ${book} ${ch}:${v}`, "", verses.get(v)!, "", links.join(" · "), ""];
      writeFileSync(join(verseDir, `${book} ${ch}.${v}.md`), body.join("\n")); nV++;
    }
  }
  console.log(`已写入 ${nCh} 篇章节笔记和 ${nV} 篇经节笔记，目录：${values.out}`);
}
try { main(); } catch (error) { console.error(`错误：${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
