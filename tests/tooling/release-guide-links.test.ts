import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { copyTree } from "../../src/tooling/build-template";

const root = resolve(import.meta.dir, "../..");
const guides = ["README.md", "使用指南/14 AI 助手与 Agent Client.md", "使用指南/19 Obsidian MCP 桥接.md"];
function markdownTargets(text: string): string[] {
  return [...text.matchAll(/\]\(([^)]+)\)/g)]
    .map(match => decodeURIComponent(match[1]!.split("#")[0]!))
    .filter(target => !/^[a-z]+:/i.test(target) && target.endsWith(".md"));
}

test("candidate assistant guides retain their local Markdown destinations", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "life-os-guide-links-"));
  const source = join(temporary, "source"), candidate = join(temporary, "candidate");
  try {
    const files = new Set(guides);
    for (const guide of guides) {
      for (const target of markdownTargets(await readFile(join(root, guide), "utf8"))) {
        files.add(relative(root, resolve(root, dirname(guide), target)));
      }
    }
    for (const file of files) {
      await mkdir(dirname(join(source, file)), { recursive: true });
      await writeFile(join(source, file), await readFile(join(root, file)));
    }
    await copyTree(source, candidate);
    for (const guide of guides) {
      const text = await readFile(join(candidate, guide), "utf8");
      for (const target of markdownTargets(text)) {
        expect(await Bun.file(resolve(candidate, dirname(guide), target)).exists(), `${guide}: ${target}`).toBe(true);
      }
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
