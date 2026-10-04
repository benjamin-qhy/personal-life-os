import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

test("发行门槛发现机器凭据时在扫描正文前停止且不回显内容", async () => {
  await mkdir("build/tooling-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/tooling-tests/preflight-"));
  try {
    const settings = join(root, ".obsidian/plugins/obsidian-local-rest-api");
    await mkdir(settings, { recursive: true });
    await writeFile(join(settings, "data.json"), JSON.stringify({ apiKey: "SYNTHETIC_PRIVATE_SENTINEL" }));
    const { verifyTemplate } = await import("../../src/tooling/verify-template");
    const results = await verifyTemplate(root);
    expect(results.length).toBe(1);
    expect(results[0]!.ok).toBe(false);
    expect(JSON.stringify(results)).not.toContain("SYNTHETIC_PRIVATE_SENTINEL");
    expect(results[0]!.detail).toContain("正文扫描已跳过");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("设置文件是符号链接时不会读取链接内容", async () => {
  const fs = await import("node:fs/promises");
  const { spyOn } = await import("bun:test");
  const root = await mkdtemp(resolve("build/tooling-tests/symlink-preflight-"));
  const vault = join(root, "vault"), settings = join(vault, ".obsidian/plugins/agent-client/data.json");
  await mkdir(join(vault, ".obsidian/plugins/agent-client"), { recursive: true });
  await writeFile(join(root, "outside.json"), '{}'); await fs.symlink(join(root, "outside.json"), settings);
  const original = fs.readFile; let attempted = false;
  const read = spyOn(fs, "readFile").mockImplementation(((...args: Parameters<typeof fs.readFile>) => {
    if (String(args[0]) === settings) attempted = true;
    return original(...args);
  }) as typeof fs.readFile);
  try {
    const { verifyTemplate } = await import("../../src/tooling/verify-template");
    const results = await verifyTemplate(vault);
    expect(results.some(r => !r.ok)).toBe(true);
    expect(attempted).toBe(false);
  } finally { read.mockRestore(); await rm(root, { recursive: true, force: true }); }
});
