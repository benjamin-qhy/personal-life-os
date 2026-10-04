import { expect, test } from "bun:test";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

test("独立发行运行文件从无依赖测试库启动并完成中文 ACP 请求", async () => {
  const build = Bun.spawn([process.execPath, resolve("scripts/build_pi_runtime.ts")], { stdout: "pipe", stderr: "pipe" });
  expect(await build.exited, await new Response(build.stderr).text()).toBe(0);
  const root = await mkdtemp(join(tmpdir(), "personal-life-os-runtime-"));
  await copyFile(resolve("dist/ai-runtime/pi-acp.js"), join(root, "pi-acp.js"));
  const cwd = join(root, "vault"); await mkdir(cwd);
  await writeFile(join(cwd, "附件.md"), "合成附件内容");
  const requests: string[] = [];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    requests.push(await request.text());
    return new Response('data: {"id":"test","object":"chat.completion.chunk","created":0,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"收到"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { "content-type": "text/event-stream" } });
  } });
  const child = Bun.spawn([process.execPath, join(root, "pi-acp.js")], {
    cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { PATH: process.env.PATH,
      LIFE_OS_PROVIDER: "test", LIFE_OS_MODEL: "test", LIFE_OS_API_KEY: "synthetic",
      LIFE_OS_BASE_URL: `http://127.0.0.1:${server.port}/v1`, LIFE_OS_SESSION_DIR: join(root, "sessions") },
  });
  const client = new ClientSideConnection(() => ({ sessionUpdate() {}, requestPermission() { return { outcome: { outcome: "cancelled" } }; } }), ndJsonStream(new WritableStream({ write(chunk) { child.stdin.write(chunk); } }), child.stdout));
  try {
    const init = await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    expect(init.agentCapabilities?.promptCapabilities?.embeddedContext).toBe(true);
    const { sessionId } = await client.newSession({ cwd, mcpServers: [] });
    expect((await client.prompt({ sessionId, prompt: [
      { type: "text", text: "请总结选区和附件" },
      { type: "resource", resource: { uri: pathToFileURL(join(cwd, "未保存.md")).href, mimeType: "text/markdown", text: "合成未保存选区" } },
      { type: "resource_link", uri: pathToFileURL(join(cwd, "附件.md")).href, name: "附件" },
    ] })).stopReason).toBe("end_turn");
    expect(requests[0]).toContain("合成未保存选区"); expect(requests[0]).toContain("合成附件内容");
    await expect(client.prompt({ sessionId, prompt: [{ type: "resource_link", uri: pathToFileURL(join(root, "外部.md")).href, name: "外部" }] })).rejects.toThrow();
    expect(requests).toHaveLength(1);
  } finally { child.kill(); await child.exited; server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 30000);
