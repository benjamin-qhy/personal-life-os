import { expect, test } from "bun:test";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION, type SessionNotification } from "@agentclientprotocol/sdk";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";

test("ACP 创建会话后通过 Pi 返回中文消息，并拒绝不存在的会话", async () => {
  const updates: SessionNotification[] = [];
  await mkdir("build/acp-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/acp-tests/session-"));
  const cwd = join(root, "vault"); await mkdir(cwd);
  let requestCount = 0;
  const waiting = Promise.withResolvers<void>();
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch() {
    requestCount++;
    if (requestCount === 2) {
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"id":"wait","object":"chat.completion.chunk","created":0,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"等待中"},"finish_reason":null}]}\n\n'));
        waiting.resolve();
      } }), { headers: { "content-type": "text/event-stream" } });
    }
    if (requestCount === 4) {
      return new Response('data: {"id":"length","object":"chat.completion.chunk","created":0,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"未完成"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n',
        { headers: { "content-type": "text/event-stream" } });
    }
    return new Response('data: {"id":"test","object":"chat.completion.chunk","created":0,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"你好"},"finish_reason":null}]}\n\ndata: {"id":"test","object":"chat.completion.chunk","created":0,"model":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } });
  } });
  const child = Bun.spawn([process.execPath, fileURLToPath(new URL("../../src/acp/main.ts", import.meta.url))], {
    stdin: "pipe", stdout: "pipe", stderr: "pipe",
    env: { PATH: process.env.PATH ?? "", LIFE_OS_PROVIDER: "test", LIFE_OS_MODEL: "test",
      LIFE_OS_BASE_URL: `http://127.0.0.1:${server.port}/v1`, LIFE_OS_API_KEY: "synthetic",
      LIFE_OS_SESSION_DIR: join(root, "sessions") },
  });
  const stderr = new Response(child.stderr).text();
  const timer = setTimeout(() => child.kill(), 30000);
  const client = new ClientSideConnection(() => ({
    sessionUpdate(update) { updates.push(update); },
    requestPermission() { return { outcome: { outcome: "cancelled" } }; },
  }), ndJsonStream(new WritableStream<Uint8Array>({
    write(chunk) { child.stdin.write(chunk); }, close() { child.stdin.end(); },
  }), child.stdout));
  try {
    await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    const { sessionId } = await client.newSession({ cwd, mcpServers: [] });
    const result = await client.prompt({ sessionId, prompt: [{ type: "text", text: "你好" }] });
    expect(result.stopReason).toBe("end_turn");
    expect(updates.some(({ update }) => update.sessionUpdate === "agent_message_chunk" &&
      update.content.type === "text" && update.content.text === "你好")).toBe(true);
    await expect(client.prompt({ sessionId: "missing", prompt: [{ type: "text", text: "hello" }] }))
      .rejects.toThrow("会话不存在");
    const pending = client.prompt({ sessionId, prompt: [{ type: "text", text: "请等待" }] });
    await waiting.promise;
    await expect(client.prompt({ sessionId, prompt: [{ type: "text", text: "同时提交" }] }))
      .rejects.toThrow("正在回复");
    await client.cancel({ sessionId });
    expect((await pending).stopReason).toBe("cancelled");
    expect((await client.prompt({ sessionId, prompt: [{ type: "text", text: "取消后继续" }] })).stopReason)
      .toBe("end_turn");
    expect((await client.prompt({ sessionId, prompt: [{ type: "text", text: "输出上限" }] })).stopReason)
      .toBe("max_tokens");
    const [bucket] = await readdir(join(root, "sessions"));
    await rm(join(root, "sessions", bucket!, `${sessionId}.json.lock`), { recursive: true });
    await Bun.sleep(11000);
    const before = requestCount;
    await expect(client.prompt({ sessionId, prompt: [{ type: "text", text: "失锁后不能继续" }] }))
      .rejects.toThrow("占用锁已失效");
    expect(requestCount).toBe(before);
  } finally {
    child.stdin.end(); child.kill(); clearTimeout(timer); server.stop(true);
    await child.exited;
    expect(await stderr).not.toContain("synthetic");
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
