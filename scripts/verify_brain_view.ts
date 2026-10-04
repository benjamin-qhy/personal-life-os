import type {} from "./browser-fixture-types.ts";
import type * as Playwright from "playwright";
// Visual and interaction regression using synthetic notes only.
// Usage: PLAYWRIGHT_MODULE=/absolute/path/to/playwright bun scripts/verify_brain_view.ts
import fs from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright") as typeof Playwright;
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  // Existing fixture assertions use English month and control labels.
  const page = await browser.newPage({ locale: "en-US", viewport: { width: 1440, height: 960 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent('<html><head></head><body style="margin:0;font-family:Arial"><div id="root" style="height:100vh"></div></body></html>');
  await page.evaluate(() => {
    const badge = document.createElement("div");
    badge.textContent = "SYNTHETIC FIXTURE · No live vault or provider data";
    badge.setAttribute("role", "note");
    badge.style.cssText = "position:fixed;bottom:0;left:0;z-index:9999;background:#172129;color:#bed0da;padding:3px 8px;font:10px Arial;pointer-events:none";
    document.body.appendChild(badge);
  });
  assert.equal(await page.getByRole("note").count(), 1);
  await page.addStyleTag({ content: fs.readFileSync(".obsidian/plugins/life-os-app/styles.css", "utf8") });
  await page.evaluate((source) => {
    HTMLElement.prototype.empty = function () { this.replaceChildren(); };
    HTMLElement.prototype.addClass = function (name) { this.classList.add(name); };
    HTMLElement.prototype.setText = function (text) { this.textContent = text; };
    HTMLElement.prototype.createEl = function (tag, options = {}) {
      const child = document.createElement(tag);
      if (options.cls) child.className = options.cls;
      if (options.text) child.textContent = options.text;
      for (const [key, value] of Object.entries(options.attr || {})) child.setAttribute(key, value);
      this.appendChild(child); return child;
    };
    HTMLElement.prototype.createDiv = function (options) { return this.createEl("div", options); };
    HTMLElement.prototype.createSpan = function (options) { return this.createEl("span", options); };
    class ItemView {
      app: unknown; contentEl: Element | null;
      constructor(leaf: { app: unknown }) { this.app = leaf.app; this.contentEl = document.querySelector("#root"); }
      registerDomEvent(element: EventTarget, name: string, handler: EventListener, options?: boolean | AddEventListenerOptions) { element.addEventListener(name, handler, options); }
      registerEvent() {}
    }
    class TFile { path: string; basename: string; constructor(path: string) { this.path = path; this.basename = path.split("/").pop()!.replace(/\.md$/, ""); } }
    const module = { exports: {} };
    class Component { registerDomEvent(el: EventTarget, name: string, fn: EventListener, options?: boolean | AddEventListenerOptions) { el.addEventListener(name, fn, options); } registerEvent() {} }
    const require = () => ({ Component, ItemView, TFile, Plugin: class {}, Modal: class {}, Notice: class {}, setIcon() {} });
    // Dynamic plugin evaluation is the untyped VM boundary; observed instances use FixtureBrain.
    const BrainView = new Function("require", "module", `${source}; return LifeOSBrainRenderer;`)(require, module);
    const folders = ["03 Planning", "04 Projects", "01 Journal/Daily", "02 Retreats", "05 People", "07 Library", "06 Writing", "08 Tasks"];
    const files = Array.from({ length: 160 }, (_, i) => new TFile(`${folders[i % folders.length]}/Note ${String(i + 1).padStart(3, "0")}.md`));
    const links: Record<string, Record<string, number>> = {};
    for (let i = 0; i < files.length; i++) links[files[i]!.path] = { [files[(i + 1) % files.length]!.path]: 1, [files[(i + 8) % files.length]!.path]: 1 };
    window.openedNotes = [];
    window.graphCommands = [];
    const app = {
      vault: { getMarkdownFiles: () => [...files, new TFile("Templates/Project.md")], getAbstractFileByPath: (path: string) => files.find((file) => file.path === path), on() {} },
      metadataCache: { resolvedLinks: links, getFileCache: () => ({ frontmatter: { tags: ["example"] } }), on() {} },
      commands: { executeCommandById: (id: string) => { window.graphCommands.push(id); return true; } },
      workspace: { getLeaf: () => ({ openFile: async (file: TFile) => window.openedNotes.push(file.path) }), revealLeaf: async () => {} },
    };
    window.brain = new BrainView(app, document.querySelector("#root"));
    return window.brain.onOpen();
  }, fs.readFileSync(".obsidian/plugins/life-os-app/main.js", "utf8"));
  assert.equal(await page.evaluate(() => window.brain.nodes.length), 160);
  assert.equal(await page.evaluate(() => window.brain.edges.length), 320);
  assert.equal(await page.evaluate(() => window.brain.projected.length), 160);
  assert.ok(await page.evaluate(() => window.brain.visibleLabels.length > 0));
  const autoLabels = await page.evaluate(() => window.brain.visibleLabels.length);
  await page.getByRole("combobox", { name: "Note labels" }).selectOption("all");
  assert.ok(await page.evaluate((n) => window.brain.visibleLabels.length >= n, autoLabels));
  await page.getByRole("combobox", { name: "Note labels" }).selectOption("off");
  assert.equal(await page.evaluate(() => window.brain.visibleLabels.length), 0);
  await page.getByRole("combobox", { name: "Note labels" }).selectOption("auto");
  assert.ok(await page.evaluate(() => new Set(window.brain.projected.map((p) => p.depth.toFixed(3))).size > 10), "Nodes must have genuine projected depth");
  await page.getByRole("button", { name: "People", exact: true }).click();
  assert.match(await page.locator(".life-os-brain-header p").innerText(), /^20 notes/);
  await page.getByRole("button", { name: "All regions", exact: true }).click();
  await page.getByRole("searchbox").fill("Note 001");
  assert.match(await page.locator(".life-os-brain-header p").innerText(), /^1 notes/);
  await page.locator(".life-os-brain-note").first().click();
  await page.getByRole("button", { name: "Open note", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.openedNotes), ["03 Planning/Note 001.md"]);
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  await page.locator("canvas").focus();
  const yaw = await page.evaluate(() => window.brain.yaw);
  await page.keyboard.press("ArrowRight");
  assert.ok(await page.evaluate((before) => window.brain.yaw > before, yaw));
  await page.keyboard.press("+");
  assert.ok(await page.evaluate(() => window.brain.zoom > 1));
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  assert.equal(await page.evaluate(() => window.brain.zoom), 1);
  const rotationTimings = await page.evaluate(() => {
    const times = [], initial = window.brain.yaw;
    for (let i=0;i<20;i++) { window.brain.yaw += 0.04; const t=performance.now(); window.brain.draw(); times.push(performance.now()-t); }
    window.brain.yaw=initial; window.brain.draw();
    return times.sort((a,b)=>a-b);
  });
  console.log(`3D rotation CPU time: median ${rotationTimings[10]!.toFixed(1)}ms, p95 ${rotationTimings[19]!.toFixed(1)}ms (synthetic browser).`);
  const canvasBox = await page.locator("canvas").boundingBox();
  assert.ok(canvasBox, "Canvas must have a bounding box");
  await page.mouse.move(canvasBox.x+50,canvasBox.y+50);
  await page.keyboard.down("Shift"); await page.mouse.down();
  await page.mouse.move(canvasBox.x+80,canvasBox.y+70); await page.mouse.up(); await page.keyboard.up("Shift");
  assert.equal(await page.evaluate(() => window.brain.panX),30);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  const position = await page.evaluate(() => { const p = window.brain.projected.at(-1)!; const r = window.brain.canvas.getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top }; });
  await page.mouse.move(position.x, position.y);
  assert.equal(await page.locator(".life-os-brain-tooltip").isVisible(), true);
  assert.match(await page.locator(".life-os-brain-tooltip").innerText(), /4 connections.*Sample note/);
  assert.equal(await page.evaluate(() => window.brain.selected), null);
  assert.ok(await page.evaluate(() => Boolean(window.brain.hovered)));
  await page.evaluate(() => {
    window.drawCount = 0;
    const draw = window.brain.draw.bind(window.brain);
    window.brain.draw = () => { window.drawCount++; draw(); };
  });
  await page.mouse.move(position.x + 0.1, position.y + 0.1);
  assert.equal(await page.evaluate(() => window.drawCount), 0, "Same-node hover must not redraw the graph");
  const timings = await page.evaluate(() => {
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now(); window.brain.draw(); samples.push(performance.now() - start);
    }
    return samples.sort((a, b) => a - b);
  });
  console.log(`Synthetic 160-note render CPU time: median ${timings[15]!.toFixed(1)}ms, p95 ${timings[28]!.toFixed(1)}ms (not native frame latency).`);
  await page.screenshot({ path: "/tmp/life-os-brain-hover-preview.png" });
  await page.mouse.move(10, 10);
  assert.equal(await page.locator(".life-os-brain-tooltip").isVisible(), false);
  assert.equal(await page.evaluate(() => window.brain.hovered), null);
  await page.mouse.click(position.x, position.y);
  assert.ok(await page.evaluate(() => Boolean(window.brain.selected)));
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  await page.getByRole("button", { name: "Standard graph", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.graphCommands), ["graph:open"]);
  await page.screenshot({ path: "/tmp/life-os-brain-preview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.brain.onClose());
  assert.equal(await page.locator("canvas").count(), 0);
  console.log("Brain browser checks passed: graph data, exclusions, filters, search, hover details, hover without selection, hover cleanup, selection, note opening, keyboard, zoom, reset, standard graph, mobile width, cleanup.");
} finally { await browser.close(); }
