import { expect, test } from "bun:test";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

test.each(["direct", "external", "inside", "missing-env", "stdio", "built", "task-zh", "task-mixed", "scoped-zh"])("ACP 接通显式只读 MCP，未知写工具不注册，库外配置 %s", async (fromFile) => {
  await mkdir("build/acp-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/acp-tests/mcp-")); const cwd = join(root, "vault"); await mkdir(cwd);
  const scopedPath = fromFile === "task-zh" ? "08 任务/任务总表.md" : fromFile === "task-mixed" ? "08 Tasks/任务总表.md" : ["built", "scoped-zh"].includes(fromFile) ? "04 项目/合成项目.md" : undefined;
  if (scopedPath) { await mkdir(join(cwd, scopedPath.split("/")[0]!), { recursive: true }); await writeFile(join(cwd, scopedPath), "合成 MCP 笔记"); }
  const calls: string[] = []; let modelCalls = 0; let received = ""; let offered: string[] = []; let auth = "";
  const mcp = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    auth = request.headers.get("Authorization") ?? "";
    const body = await request.json() as { id?: number; method: string; params?: { name: string } };
    if (body.id === undefined) return new Response(null, { status: 202 });
    const result = body.method === "initialize" ? { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "synthetic", version: "1" } }
      : body.method === "tools/list" ? { tools: ["active_file_get_path", "vault_read", "vault_delete", "command_execute"].map(name => ({ name, inputSchema: { type: "object", properties: name === "vault_read" ? { path: { type: "string" } } : {} } })) }
      : (calls.push(body.params!.name), { content: [{ type: "text", text: "04 项目/合成项目.md" }] });
    return Response.json({ jsonrpc: "2.0", id: body.id, result });
  } });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const body = await request.json() as { tools: { function: { name: string } }[]; messages: unknown[] };
    offered = body.tools.map(tool => tool.function.name); received = JSON.stringify(body.messages);
    const delta = modelCalls++ ? { role: "assistant", content: "完成" } : { role: "assistant", tool_calls: [{ index: 0, id: "read", type: "function", function: { name: scopedPath ? "mcp_obsidian_vault_read" : "mcp_obsidian_active_file_get_path", arguments: JSON.stringify(scopedPath ? {path: scopedPath} : {}) } }] };
    return new Response(`data: ${JSON.stringify({ id: "test", object: "chat.completion.chunk", created: 0, model: "test", choices: [{ index: 0, delta, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
  } });
  const config = join(fromFile === "inside" ? cwd : root, "mcp.json");
  await writeFile(config, JSON.stringify({ mcpServers: [{ type: "http", name: "obsidian", url: `http://127.0.0.1:${mcp.port}/mcp`, headers: [{ name: "Authorization", valueEnv: "MCP_TEST_AUTH" }] }] }));
  const fixture = join(root, "mcp-server.ts");
  await writeFile(fixture, `import { createInterface } from "node:readline";
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line); if (request.id === undefined) continue;
  const result = request.method === "initialize" ? { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "test", version: "1" } }
    : request.method === "tools/list" ? { tools: [{ name: "active_file_get_path", inputSchema: { type: "object", properties: {} } }] }
    : { content: [{ type: "text", text: "04 项目/合成项目.md" }] };
  console.log(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
}`);
  if (fromFile === "built") {
    const build = Bun.spawn([process.execPath, resolve("scripts/build_pi_runtime.ts")], { stdout: "ignore", stderr: "ignore" });
    expect(await build.exited).toBe(0);
  }
  const child = Bun.spawn([process.execPath, resolve(fromFile === "built" ? "dist/ai-runtime/pi-acp.js" : "src/acp/main.ts")], { stdin: "pipe", stdout: "pipe", stderr: "ignore", env: { PATH: process.env.PATH, LIFE_OS_PROVIDER: "test", LIFE_OS_MODEL: "test", LIFE_OS_API_KEY: "synthetic", LIFE_OS_BASE_URL: `http://127.0.0.1:${server.port}/v1`, LIFE_OS_SESSION_DIR: join(root, "sessions"), ...(fromFile !== "direct" ? { LIFE_OS_MCP_CONFIG: config } : {}), ...(fromFile !== "missing-env" ? { MCP_TEST_AUTH: "Bearer synthetic-only" } : {}) } });
  const timer = setTimeout(() => child.kill(), 10000);
  const client = new ClientSideConnection(() => ({ sessionUpdate() {}, requestPermission() { return { outcome: { outcome: "cancelled" } }; } }), ndJsonStream(new WritableStream({ write(chunk) { child.stdin.write(chunk); } }), child.stdout));
  try {
    await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    if (["inside", "missing-env"].includes(fromFile)) {
      await expect(client.newSession({ cwd, mcpServers: [] })).rejects.toThrow("MCP连接失败");
      expect(calls).toHaveLength(0); return;
    }
    const { sessionId } = await client.newSession({ cwd, mcpServers: fromFile === "stdio" ? [{ name: "obsidian", command: process.execPath, args: [fixture], env: [] }] : fromFile !== "direct" ? [] : [{ type: "http", name: "obsidian", url: `http://127.0.0.1:${mcp.port}/mcp`, headers: [] }] });
    await client.prompt({ sessionId, prompt: [{ type: "text", text: "获取当前笔记" }] });
    if (fromFile === "external") expect(auth).toBe("Bearer synthetic-only");
    expect(calls).toEqual(fromFile === "stdio" || fromFile.startsWith("task-") ? [] : [scopedPath ? "vault_read" : "active_file_get_path"]);
    if (fromFile.startsWith("task-")) expect(received).toContain("不含任务总表");
    else expect(received).toContain("合成项目.md");
    expect(offered).not.toContain("mcp_obsidian_vault_delete"); expect(offered).not.toContain("mcp_obsidian_command_execute");
  } finally { clearTimeout(timer); child.kill(); await child.exited; server.stop(true); mcp.stop(true); await rm(root, { recursive: true, force: true }); }
}, 15000);
