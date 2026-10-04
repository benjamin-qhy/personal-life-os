import { expect, test } from "bun:test";
import { createPiSession } from "../../src/acp/pi-session";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";

test("Pi 通过本机 OpenAI 兼容接口完成中文流式请求，不启用默认文件或命令工具", async () => {
  let calls = 0;
  await mkdir("build/acp-tests", { recursive: true });
  const cwd = await mkdtemp(resolve("build/acp-tests/vault-"));
  await mkdir(join(cwd, ".pi"));
  await writeFile(join(cwd, "APPEND_SYSTEM.md"), "ROOT_PRIVATE_SENTINEL");
  await writeFile(join(cwd, ".pi", "APPEND_SYSTEM.md"), "PROJECT_PRIVATE_SENTINEL");
  let sentMessages = "";
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    async fetch(request) {
      calls++;
      expect(request.headers.get("authorization")).toBe("Bearer synthetic-test-key");
      const body = await request.json() as { model: string; tools?: unknown[]; messages: unknown[] };
      expect(body.model).toBe("synthetic-model");
      expect(body.tools ?? []).toHaveLength(0);
      expect(JSON.stringify(body.messages)).toContain("你好");
      sentMessages = JSON.stringify(body.messages);
      const event = (delta: object, finish_reason: string | null = null) =>
        `data: ${JSON.stringify({ id: "synthetic", object: "chat.completion.chunk", created: 0,
          model: "synthetic-model", choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
      return new Response(event({ role: "assistant", content: "你好，秋水。" }) +
        event({}, "stop") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    },
  });
  try {
    const session = await createPiSession(cwd, {
      LIFE_OS_PROVIDER: "synthetic", LIFE_OS_MODEL: "synthetic-model",
      LIFE_OS_BASE_URL: `http://127.0.0.1:${server.port}/v1`, LIFE_OS_API_KEY: "synthetic-test-key",
    });
    try {
      expect(session.getActiveToolNames()).toEqual([]);
      await session.prompt("你好");
      expect(session.getLastAssistantText(), JSON.stringify(session.messages)).toBe("你好，秋水。");
      expect(calls).toBe(1);
      expect(sentMessages).not.toContain("PRIVATE_SENTINEL");
    } finally { session.dispose(); }
  } finally { server.stop(true); await rm(cwd, { recursive: true, force: true }); }
}, 15000);
