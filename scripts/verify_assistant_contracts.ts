#!/usr/bin/env bun
// Read system workflow definitions only. Never connects to an agent or provider.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(process.argv[2] || ".");
const source = fs.readFileSync(path.join(root, "00 Dashboards/Assistant.md"), "utf8");
const buttons = [...source.matchAll(/```agent\n([\s\S]*?)```/g)];
assert.equal(buttons.length, 16, "All 16 assistant workflows must remain available");
for (const [, block] of buttons) {
  assert.ok(block, "Workflow block must exist");
  assert.match(block, /^autoSend: false$/m, "Workflow must require a separate send action");
  assert.match(block, /^type: button$/m);
  const promptPath = block.match(/Read (Prompts\/[^"\n]+?\.md) with vault_read/);
  assert.ok(promptPath, "Workflow must name a local prompt");
  assert.ok(promptPath[1], "Workflow prompt path must exist");
  assert.ok(fs.existsSync(path.join(root, promptPath[1])), "Named prompt must exist");
}
assert.match(source, /## Before you send/);
assert.match(source, /policy, not a technical guarantee/);
assert.match(source, /noteContext: hosting/);
assert.match(source, /not proof of authentication/);
console.log("助手契约验证通过：16 个工作流均需明确发送，提示词路径有效，已说明上下文与权限边界。未验证原生客户端行为。");
