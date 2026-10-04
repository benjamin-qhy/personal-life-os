import { expect, test } from "bun:test";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

test("Agent Client 列举并切换模型，后续请求使用选择的模型", async () => {
  await mkdir("build/acp-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/acp-tests/context-"));
  const cwd = join(root, "vault"); await mkdir(cwd);
  const requests: string[] = [];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    requests.push(await request.text());
    return new Response('data: {"id":"test","object":"chat.completion.chunk","created":0,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"收到"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { "content-type": "text/event-stream" } });
  } });
  const launch = () => {
  const child = Bun.spawn([process.execPath, resolve("src/acp/main.ts")], {
    stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { PATH: process.env.PATH,
      LIFE_OS_PROVIDER: "test", LIFE_OS_MODEL: "test", LIFE_OS_MODELS: "test,second", LIFE_OS_API_KEY: "synthetic",
      LIFE_OS_BASE_URL: `http://127.0.0.1:${server.port}/v1`, LIFE_OS_SESSION_DIR: join(root, "sessions") },
  });
  const client = new ClientSideConnection(() => ({ sessionUpdate() {}, requestPermission() { return { outcome: { outcome: "cancelled" } }; } }), ndJsonStream(new WritableStream({ write(chunk) { child.stdin.write(chunk); } }), child.stdout));
  return { child, client };
  };
  let { child, client } = launch();
  try {
    await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    const session = await client.newSession({ cwd, mcpServers: [] });
    expect(session.configOptions?.[0]?.category).toBe("model");
    const selected = await client.setSessionConfigOption({ sessionId: session.sessionId, configId: "model", value: "second" });
    expect(selected.configOptions[0]?.type === "select" && selected.configOptions[0].currentValue).toBe("second");
    await client.prompt({ sessionId: session.sessionId, prompt: [{ type: "text", text: "模型切换测试" }] });
    expect(JSON.parse(requests[0]!).model).toBe("second");
    child.stdin.end(); await child.exited;
    ({ child, client } = launch());
    await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    const restored = await client.loadSession({ sessionId: session.sessionId, cwd, mcpServers: [] });
    expect(restored.configOptions?.[0]?.type === "select" && restored.configOptions[0].currentValue).toBe("second");
    await expect(client.setSessionConfigOption({ sessionId: session.sessionId, configId: "model", value: "missing" })).rejects.toThrow();
  } finally { child.kill(); await child.exited; server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 15000);
