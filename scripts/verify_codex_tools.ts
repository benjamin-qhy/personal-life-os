import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.argv.includes("--live")) {
  console.error("真实订阅工具验收需显式指定 --live。"); process.exit(2);
}
await mkdir("build/acp-live", { recursive: true });
const root = await mkdtemp(resolve("build/acp-live/tools-"));
const cwd = join(root, "vault"); await mkdir(cwd);
const path = join(cwd, "note.md");
const before = "## 验收\n合成原文\n";
const after = before + "\n订阅写入验收通过\n\n";
await writeFile(path, before);
let expectedChange = { path, before, after };
let allow = true;
let approvals = 0;
let reply = "";
let firstChunk: (() => void) | undefined;
const launch = () => {
  const env: Record<string, string> = {
    LIFE_OS_AUTH: "codex", LIFE_OS_PROVIDER: "openai-codex", LIFE_OS_MODEL: "gpt-6.1-sol",
    LIFE_OS_SESSION_DIR: join(root, "sessions"),
  };
  for (const name of ["PATH", "HOME", "CODEX_HOME", "https_proxy", "http_proxy", "all_proxy",
    "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "no_proxy"]) {
    if (process.env[name]) env[name] = process.env[name]!;
  }
  const child = Bun.spawn([process.execPath, process.argv.includes("--runtime") ? resolve(process.argv[process.argv.indexOf("--runtime") + 1]!) : fileURLToPath(new URL("../src/acp/main.ts", import.meta.url))], {
    env, stdin: "pipe", stdout: "pipe", stderr: "ignore",
  });
  const timer = setTimeout(() => child.kill(), 120000);
  const client = new ClientSideConnection(() => ({
    sessionUpdate({ update }) {
      if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") {
        reply += update.content.text; firstChunk?.();
      }
    },
    requestPermission(request) {
      approvals++;
      const diff = request.toolCall.content?.[0];
      const exact = diff?.type === "diff" && diff.path === expectedChange.path && diff.oldText === expectedChange.before && diff.newText === expectedChange.after;
      return { outcome: { outcome: "selected", optionId: allow && exact ? "allow_once" : "reject_once" } };
    },
  }), ndJsonStream(new WritableStream<Uint8Array>({ write(chunk) { child.stdin.write(chunk); } }), child.stdout));
  return { client, async close() { child.stdin.end(); await child.exited; clearTimeout(timer); } };
};
let active = launch();
try {
  await active.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
  const { sessionId } = await active.client.newSession({ cwd, mcpServers: [] });
  const prompt = [{ type: "text" as const, text: "这是独立合成测试库。请使用 append_note 工具，在 note.md 的现有二级标题“验收”下追加且只追加文本“订阅写入验收通过”。等待工具审批结果，不要尝试其他写入方式；若拒绝，直接停止。" }];
  await active.client.prompt({ sessionId, prompt });
  const approvedWrite = approvals === 1 && await readFile(path, "utf8") === after;
  console.log(JSON.stringify({ stage: "approved-write", passed: approvedWrite }));
  if (!approvedWrite) throw new Error("write-check");

  await active.close(); active = launch(); reply = "";
  await active.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
  await active.client.loadSession({ sessionId, cwd, mcpServers: [] });
  reply = "";
  await active.client.prompt({ sessionId, prompt: [{ type: "text", text: "仅根据已有对话回忆：上次成功追加的文本是什么？不要调用工具，只输出那段文本。" }] });
  const recovered = reply.includes("订阅写入验收通过");
  console.log(JSON.stringify({ stage: "restart-recovery", passed: recovered }));
  if (!recovered) throw new Error("recovery-check");

  await writeFile(path, before); allow = false; approvals = 0;
  const rejected = await active.client.newSession({ cwd, mcpServers: [] });
  await active.client.prompt({ sessionId: rejected.sessionId, prompt });
  const unchanged = approvals >= 1 && await readFile(path, "utf8") === before;
  console.log(JSON.stringify({ stage: "rejected-write", passed: unchanged }));
  if (!unchanged) throw new Error("reject-check");

  const cancellable = await active.client.newSession({ cwd, mcpServers: [] });
  const started = Promise.withResolvers<void>(); firstChunk = started.resolve;
  const pending = active.client.prompt({ sessionId: cancellable.sessionId, prompt: [{ type: "text",
    text: "这是取消测试，不调用任何工具。请用中文连续写出编号 1 到 1000，每一项附上一句至少二十字的合成天气描述。" }] });
  // A completed response before any chunk is a failed cancellation scenario, not a hanging test.
  void pending.then(() => started.resolve(), () => started.resolve());
  await started.promise; firstChunk = undefined;
  await active.client.cancel({ sessionId: cancellable.sessionId });
  const cancelled = (await pending).stopReason === "cancelled";
  console.log(JSON.stringify({ stage: "cancel-stream", passed: cancelled }));
  if (!cancelled) throw new Error("cancel-check");
  reply = "";
  const resumed = await active.client.prompt({ sessionId: cancellable.sessionId, prompt: [{ type: "text",
    text: "刚才的长输出已取消，不要继续它。现在只回答：取消后继续验收通过" }] });
  const continued = resumed.stopReason === "end_turn" && reply.includes("取消后继续验收通过");
  console.log(JSON.stringify({ stage: "continue-after-cancel", passed: continued }));
  if (!continued) throw new Error("continue-check");

  const scorePath = join(cwd, "01 Journal/Daily/2026-10-04.md");
  const scoreBefore = "---\ndq_focus: 4\n---\n## 回顾\n### 收获\n合成原文\n### 保留\n保留段\n";
  const scoreAfter = "---\ndq_focus: 7\n---\n## 回顾\n### 收获\n合成原文\n### 保留\n保留段\n";
  await mkdir(join(cwd, "01 Journal/Daily"), { recursive: true }); await writeFile(scorePath, scoreBefore);
  expectedChange = { path: scorePath, before: scoreBefore, after: scoreAfter }; allow = true; approvals = 0;
  const coaching = await active.client.newSession({ cwd, mcpServers: [] });
  await active.client.prompt({ sessionId: coaching.sessionId, prompt: [{ type: "text", text: "这是独立合成评分测试，我明确把 dq_focus 评分定为7。请使用 set_note_property 更新 01 Journal/Daily/2026-10-04.md 的现有 dq_focus 属性为数字7，等待准确差异审批，不改正文。" }] });
  const scorePassed = approvals === 1 && await readFile(scorePath, "utf8") === scoreAfter;
  console.log(JSON.stringify({ stage: "approved-score-property", passed: scorePassed }));
  if (!scorePassed) throw new Error("score-check");

  const h3After = "---\ndq_focus: 7\n---\n## 回顾\n### 收获\n合成原文\n\n合成三级标题验收\n\n### 保留\n保留段\n";
  expectedChange = { path: scorePath, before: scoreAfter, after: h3After }; approvals = 0;
  await active.client.prompt({ sessionId: coaching.sessionId, prompt: [{ type: "text", text: "现在使用 append_note，path仍为 01 Journal/Daily/2026-10-04.md，heading为收获、level为3、text严格为合成三级标题验收。等待单次审批，不修改其他内容。" }] });
  const h3Passed = approvals === 1 && await readFile(scorePath, "utf8") === h3After;
  console.log(JSON.stringify({ stage: "approved-h3-append", passed: h3Passed }));
  if (!h3Passed) throw new Error("h3-check");
} catch {
  console.log(JSON.stringify({ passed: false, message: "真实工具验收未完成，底层响应已隐藏。" }));
  process.exitCode = 1;
} finally {
  await active.close(); await rm(root, { recursive: true, force: true });
}
