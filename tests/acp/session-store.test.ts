import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { SessionStore } from "../../src/acp/session-store";

test("会话保存在库外，重新打开可恢复上下文且不能跨库加载", async () => {
  await mkdir("build/acp-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/acp-tests/store-"));
  const vault = join(root, "vault"), other = join(root, "other");
  await mkdir(vault); await mkdir(other);
  try {
    const store = await SessionStore.open(vault, join(root, "sessions"));
    const id = crypto.randomUUID();
    const release = await store.acquire(id);
    const competing = await SessionStore.open(vault, join(root, "sessions"));
    await expect(competing.acquire(id)).rejects.toThrow();
    const manager = SessionManager.inMemory(vault, { id });
    manager.appendMessage({ role: "user", content: "合成历史消息", timestamp: Date.now() });
    await store.save(id, manager);
    const restored = await (await SessionStore.open(vault, join(root, "sessions"))).load(id);
    expect(JSON.stringify(restored.buildSessionContext().messages)).toContain("合成历史消息");
    await expect((await SessionStore.open(other, join(root, "sessions"))).load(id)).rejects.toThrow();
    await expect(store.load("../other")).rejects.toThrow();
    await release();
    const releaseAgain = await competing.acquire(id);
    await releaseAgain();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("拒绝库内存储目录，包括指向库内的符号链接", async () => {
  await mkdir("build/acp-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/acp-tests/store-"));
  const vault = join(root, "vault"); await mkdir(vault);
  try {
    await expect(SessionStore.open(vault, join(vault, "sessions"))).rejects.toThrow("库外");
    await symlink(vault, join(root, "link"));
    await expect(SessionStore.open(vault, join(root, "link", "sessions"))).rejects.toThrow("库外");
  } finally { await rm(root, { recursive: true, force: true }); }
});
