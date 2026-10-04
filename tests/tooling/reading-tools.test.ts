import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];
function run(script: string, args: string[], cwd = process.cwd()) {
  const p = Bun.spawnSync([process.execPath, resolve(`scripts/${script}.ts`), ...args], { timeout: 10000, cwd });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}
function fixture(text: string) {
  const root = mkdtempSync(join(tmpdir(), "reading-tools-")); roots.push(root);
  const source = join(root, "source.txt"); writeFileSync(source, text);
  return { root, source, out: join(root, "reading") };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("canonical plan schedules all 1189 chapters across reading days and skips Monday", () => {
  const result = run("generate_reading_plan", ["--start", "2026-10-05", "--days", "2", "--skip-weekday", "0"]);
  expect(result.code).toBe(0);
  const lines = result.out.split("\n").filter(x => x.startsWith("- [ ]"));
  expect(lines).toHaveLength(1189);
  expect(lines[0]).toBe("- [ ] 阅读 [[Genesis 1]] ⏳ 2026-10-06");
  expect(lines.at(-1)).toBe("- [ ] 阅读 [[Revelation 22]] ⏳ 2026-10-07");
  expect(result.out).toContain("plan: canonical");
});
test("chronological plan places Job after Genesis", () => {
  const r = run("generate_reading_plan", ["--start", "2026-01-01", "--order", "chronological"]);
  expect(r.code).toBe(0);
  expect(r.out.split("\n").filter(x => x.startsWith("- [ ]"))[50]).toContain("[[Job 1]]");
});
test("invalid dates, days, weekdays, order and all skipped weekdays fail promptly", () => {
  for (const args of [["--days", "0"], ["--days", "-1"], ["--days", "1.5"], ["--skip-weekday", "7"], ["--order", "random"], ["--start", "2026-02-30"], ...[[0,1,2,3,4,5,6].flatMap(d => ["--skip-weekday", String(d)])]]) {
    const r = run("generate_reading_plan", ["--start", "2026-01-01", ...args]);
    expect(r.code).not.toBe(0); expect(r.err).toMatch(/错误/); expect(r.out).toBe("");
  }
});
test("splitter filters books, preserves links and identifiers, quotes translation, and overwrites", () => {
  const f = fixture("Genesis 1:1\tFirst\nGenesis 1:2\tSecond\nGenesis 2:1\tThird\nJohn 1:1\tExcluded\n");
  const args = [f.source, "--out", f.out, "--books", "Genesis", "--translation", "中文: 译本"];
  expect(run("split_bible", args).code).toBe(0);
  const chapter = readFileSync(join(f.out, "Chapters/Genesis 1.md"), "utf8");
  expect(chapter).toContain("type: bible-chapter"); expect(chapter).toContain('translation: "中文: 译本"');
  expect(chapter).toContain("[[Genesis 1.1]] · [[Genesis 1.2]]"); expect(chapter).toContain("[[Genesis 2]]");
  const versePath = join(f.out, "Verses/Genesis 1.2.md");
  const verse = readFileSync(versePath, "utf8");
  expect(verse).toContain("[[Genesis 1.1]]"); expect(verse).toContain("章节：[[Genesis 1]]");
  expect(readdirSync(join(f.out, "Chapters"))).toHaveLength(2);
  writeFileSync(versePath, "stale"); expect(run("split_bible", args).code).toBe(0);
  expect(readFileSync(versePath, "utf8")).toBe(verse);
});
test("Chinese book names work and path traversal lines cannot create files", () => {
  const f = fixture("创世记 1:1\t起初。\n../Escape 1:1\tBad\nfoo/bar 1:1\tBad\n创世记 1:2\t其次。\n");
  expect(run("split_bible", [f.source, "--out", f.out]).code).toBe(0);
  expect(readdirSync(join(f.out, "Chapters"))).toEqual(["创世记 1.md"]);
  expect(readFileSync(join(f.out, "Verses/创世记 1.1.md"), "utf8")).toContain("[[创世记 1.2]]");
});

test("chapter backlinks exclude their actual folder for default and custom output directories", () => {
  const f = fixture("Genesis 1:1\tFirst\nGenesis 2:1\tSecond\n");
  for (const custom of [false, true]) {
    const args = custom ? [f.source, "--out", f.out] : [f.source];
    expect(run("split_bible", args, f.root).code).toBe(0);
    const out = custom ? f.out : join(f.root, "09 Reading");
    const chapter = readFileSync(join(out, "Chapters/Genesis 1.md"), "utf8");
    expect(chapter).toContain("WHERE contains(file.outlinks, this.file.link) AND file.folder != this.file.folder");
    expect(chapter).not.toContain("Bible/Chapters");
    expect(chapter).not.toContain(f.root);
  }
});
