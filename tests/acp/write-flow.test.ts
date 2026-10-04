import { expect, test } from "bun:test";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION, type RequestPermissionRequest } from "@agentclientprotocol/sdk";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

test.each([true, false])("模型调用追加工具，审批结果 %s 决定真实文件是否变化", async (allow) => {
  await mkdir("build/acp-tests", { recursive: true });
  const cwd = await mkdtemp(resolve("build/acp-tests/write-flow-"));
  const path = join(cwd, "note.md");
  const before = "## 日记\n合成旧记录\n";
  await writeFile(path, before);
  let approval: RequestPermissionRequest | undefined;
  let calls = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const body = await request.json() as { tools?: { function: { name: string } }[] };
    expect(body.tools?.map((tool) => tool.function.name)).toContain("append_note");
    const first = ++calls === 1;
    const delta = first ? { role: "assistant", tool_calls: [{ index: 0, id: "call_append", type: "function",
      function: { name: "append_note", arguments: JSON.stringify({ path: "note.md", heading: "日记", text: "合成新记录" }) } }] }
      : { role: "assistant", content: "处理完成" };
    const chunk = (value: object, finish: string | null) => `data: ${JSON.stringify({ id: "test", object: "chat.completion.chunk",
      created: 0, model: "test", choices: [{ index: 0, delta: value, finish_reason: finish }] })}\n\n`;
    return new Response(chunk(delta, null) + chunk({}, first ? "tool_calls" : "stop") + "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } });
  } });
  const child = Bun.spawn([process.execPath, fileURLToPath(new URL("../../src/acp/main.ts", import.meta.url))], {
    stdin: "pipe", stdout: "pipe", stderr: "ignore",
    env: { PATH: process.env.PATH ?? "", LIFE_OS_PROVIDER: "test", LIFE_OS_MODEL: "test",
      LIFE_OS_BASE_URL: `http://127.0.0.1:${server.port}/v1`, LIFE_OS_API_KEY: "synthetic",
      LIFE_OS_SESSION_DIR: `${cwd}-sessions` },
  });
  const timer = setTimeout(() => child.kill(), 10000);
  const client = new ClientSideConnection(() => ({
    sessionUpdate() {},
    requestPermission(request) { approval = request; return { outcome: { outcome: "selected",
      optionId: allow ? "allow_once" : "reject_once" } }; },
  }), ndJsonStream(new WritableStream<Uint8Array>({ write(chunk) { child.stdin.write(chunk); } }), child.stdout));
  try {
    await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    const { sessionId } = await client.newSession({ cwd, mcpServers: [] });
    const result = await client.prompt({ sessionId, prompt: [{ type: "text", text: "向 note.md 日记标题下追加合成新记录。" }] });
    expect(result.stopReason).toBe("end_turn");
    expect(approval?.toolCall.content?.[0]).toMatchObject({ type: "diff", oldText: before });
    const content = await readFile(path, "utf8");
    if (allow) expect(content).toContain("合成新记录");
    else expect(content).toBe(before);
  } finally {
    clearTimeout(timer); child.stdin.end(); child.kill(); await child.exited;
    server.stop(true); await rm(cwd, { recursive: true, force: true });
    await rm(`${cwd}-sessions`, { recursive: true, force: true });
  }
}, 15000);
