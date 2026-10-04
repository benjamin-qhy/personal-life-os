import { expect, test } from "bun:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/tooling/files";

test("第一方插件由独立 TypeScript 编译，保持 CommonJS 宿主并不修改现用插件", async () => {
  const current = ".obsidian/plugins/life-os-app/main.js";
  const before = sha256(await readFile(current));
  const { compilePlugin } = await import("../../src/tooling/build-obsidian");
  const artifacts = await compilePlugin();
  expect(artifacts.map(a => a.name).sort()).toEqual(["LICENSE", "main.js", "manifest.json", "styles.css"]);
  const source = artifacts.find(a => a.name === "main.js")!.content;
  expect(source).not.toMatch(/\bBun\.|node:|@earendil-works/);
  const module = { exports: {} as unknown };
  // Module initialization only: no app, notes, DOM or real Obsidian process is loaded.
  const host = { Component: class {}, ItemView: class {}, Modal: class {}, Plugin: class {}, Notice: class {}, TFile: class {}, moment() {}, setIcon() {} };
  new vm.Script(source).runInNewContext({ module, require(id: string) {
    expect(id).toBe("obsidian"); return host;
  } });
  expect(typeof module.exports).toBe("function");
  const manifest = JSON.parse(artifacts.find(a => a.name === "manifest.json")!.content);
  expect(manifest.id).toBe("life-os-app");
  expect(manifest.name).toBe("Personal Life OS");
  expect(manifest.author).toBe("秋水 (qiushui)");
  expect(sha256(await readFile(current))).toBe(before);
});
