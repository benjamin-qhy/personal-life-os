import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildTemplate } from "../src/tooling/build-template";

// Validate generated Chinese settings together with the actual plugin, without
// changing the installed vault. The builder runs both application contracts.
const out = await realpath(await mkdtemp(join(tmpdir(), "life-os-app-candidate-")));
try {
  await buildTemplate({ live: resolve(import.meta.dir, ".."), out, name: "App-check", version: "2.0.0" });
  console.log("独立中文候选应用及 16 个提示词契约验证通过；原生 Obsidian 操作待手测。");
} finally { await rm(out, { recursive: true, force: true }); }
