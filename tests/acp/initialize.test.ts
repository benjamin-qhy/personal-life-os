import { expect, test } from "bun:test";
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { fileURLToPath } from "node:url";

test.each([PROTOCOL_VERSION, PROTOCOL_VERSION + 1])(
  "收到协议版本 %i 时返回自身支持的版本和能力",
  async (requestedVersion) => {
    const entry = fileURLToPath(new URL("../../src/acp/main.ts", import.meta.url));
    const child = Bun.spawn([process.execPath, entry], {
      stdin: "pipe", stdout: "pipe", stderr: "pipe",
    });
    const timer = setTimeout(() => child.kill(), 3000);
    try {
      child.stdin.write(JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: requestedVersion, clientCapabilities: {} },
      }) + "\n");
      child.stdin.end();
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
      ]);
      expect(exitCode, stderr).toBe(0);
      const messages = stdout.trim().split("\n").map((line) => JSON.parse(line));
      const response = messages.find((message) => message.id === 1);
      expect(response?.error).toBeUndefined();
      expect(response?.result.protocolVersion).toBe(PROTOCOL_VERSION);
      expect(response?.result.agentInfo.name).toBe("personal-life-os");
      expect(response?.result.agentCapabilities?.loadSession).toBe(true);
    } finally {
      clearTimeout(timer);
      child.kill();
    }
  },
);
