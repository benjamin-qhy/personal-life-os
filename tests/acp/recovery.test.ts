import { expect, test } from "bun:test";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION, type SessionNotification } from "@agentclientprotocol/sdk";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

test("进程退出后从库外恢复会话并保留模型上下文", async () => {
  await mkdir("build/acp-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/acp-tests/recovery-"));
  const cwd = join(root, "vault"); await mkdir(cwd);
  let calls = 0, secondContext = "";
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const body = await request.json();
    if (++calls === 2) secondContext = JSON.stringify(body);
    return new Response('data: {"id":"test","object":"chat.completion.chunk","created":0,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"已记住合成信息"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } });
  } });
  const launch = () => {
    const updates: SessionNotification[] = [];
    const child = Bun.spawn([process.execPath, fileURLToPath(new URL("../../src/acp/main.ts", import.meta.url))], {
      stdin: "pipe", stdout: "pipe", stderr: "ignore",
      env: { PATH: process.env.PATH ?? "", LIFE_OS_PROVIDER: "test", LIFE_OS_MODEL: "test",
        LIFE_OS_BASE_URL: `http://127.0.0.1:${server.port}/v1`, LIFE_OS_API_KEY: "synthetic",
        LIFE_OS_SESSION_DIR: join(root, "sessions") },
    });
    const timer = setTimeout(() => child.kill(), 10000);
    const client = new ClientSideConnection(() => ({
      sessionUpdate(update) { updates.push(update); },
      requestPermission() { return { outcome: { outcome: "cancelled" } }; },
    }), ndJsonStream(new WritableStream<Uint8Array>({ write(chunk) { child.stdin.write(chunk); } }), child.stdout));
    return { client, updates, async close() { child.stdin.end(); await child.exited; clearTimeout(timer); } };
  };
  let active = launch();
  try {
    const init = await active.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    expect(init.agentCapabilities?.loadSession).toBe(true);
    const { sessionId } = await active.client.newSession({ cwd, mcpServers: [] });
    await active.client.prompt({ sessionId, prompt: [{ type: "text", text: "历史内容-合成" }] });
    await active.close(); active = launch();
    await active.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    await active.client.loadSession({ sessionId, cwd, mcpServers: [] });
    expect(JSON.stringify(active.updates)).toContain("历史内容-合成");
    await active.client.prompt({ sessionId, prompt: [{ type: "text", text: "继续对话" }] });
    expect(secondContext).toContain("历史内容-合成");
    expect(secondContext).toContain("继续对话");
  } finally { await active.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 25000);
