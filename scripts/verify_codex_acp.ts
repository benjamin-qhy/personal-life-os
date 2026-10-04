import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 显式运行，不属于默认测试。只发送合成消息，不输出认证信息或底层错误。
if (!process.argv.includes("--live")) {
  console.error("真实订阅验收需显式指定 --live。");
  process.exit(2);
}

await mkdir("build/acp-live", { recursive: true });
const cwd = await mkdtemp(resolve("build/acp-live/vault-"));
const env: Record<string, string> = {
  LIFE_OS_AUTH: "codex", LIFE_OS_PROVIDER: "openai-codex", LIFE_OS_MODEL: "gpt-6.1-sol",
  LIFE_OS_SESSION_DIR: `${cwd}-sessions`,
};
for (const name of ["PATH", "HOME", "CODEX_HOME", "https_proxy", "http_proxy", "all_proxy",
  "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "no_proxy"]) {
  if (process.env[name]) env[name] = process.env[name]!;
}
const child = Bun.spawn([process.execPath, fileURLToPath(new URL("../src/acp/main.ts", import.meta.url))], {
  env, stdin: "pipe", stdout: "pipe", stderr: "ignore",
});
let text = "";
let chunks = 0;
let timedOut = false;
const timer = setTimeout(() => { timedOut = true; child.kill(); }, 60000);
const client = new ClientSideConnection(() => ({
  requestPermission: () => ({ outcome: { outcome: "cancelled" } }),
  sessionUpdate({ update }) {
    if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") {
      text += update.content.text; chunks++;
    }
  },
}), ndJsonStream(new WritableStream<Uint8Array>({
  write(chunk) { child.stdin.write(chunk); }, close() { child.stdin.end(); },
}), child.stdout));

try {
  await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
  const { sessionId } = await client.newSession({ cwd, mcpServers: [] });
  const result = await client.prompt({ sessionId, prompt: [{ type: "text",
    text: "这是无工具中文连通性验收。不要访问文件，不要调用工具。请只回复：订阅验收通过。",
  }] });
  const passed = result.stopReason === "end_turn" && text.trim().replace(/[。.!！]$/, "") === "订阅验收通过";
  console.log(JSON.stringify({ passed, model: env.LIFE_OS_MODEL, stopReason: result.stopReason, chunks }));
  if (!passed) process.exitCode = 1;
} catch (error) {
  const code = error !== null && typeof error === "object" && "code" in error && typeof error.code === "number"
    ? error.code : undefined;
  console.log(JSON.stringify({ passed: false, timedOut, protocolErrorCode: code }));
  process.exitCode = 1;
} finally {
  clearTimeout(timer); child.stdin.end(); child.kill(); await child.exited;
  await rm(cwd, { recursive: true, force: true });
  await rm(`${cwd}-sessions`, { recursive: true, force: true });
}
