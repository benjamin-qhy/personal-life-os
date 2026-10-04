import { SessionManager, type FileEntry } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { lock } from "proper-lockfile";

function inside(root: string, target: string) {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("../") && rel !== ".." && !isAbsolute(rel));
}

async function canonicalFuture(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await canonicalFuture(parent), basename(path));
  }
}

export class SessionStore {
  private readonly leases = new Map<string, { compromised: boolean }>();
  private constructor(private readonly cwd: string, private readonly directory: string) {}

  static async open(cwd: string, configured?: string) {
    const vault = await realpath(cwd);
    const root = await canonicalFuture(resolve(configured || join(homedir(), ".local", "share", "personal-life-os", "sessions")));
    if (inside(vault, root)) throw new Error("会话存储目录必须位于笔记库外。");
    await mkdir(root, { recursive: true, mode: 0o700 });
    const directory = join(root, createHash("sha256").update(vault).digest("hex"));
    await mkdir(directory, { mode: 0o700 }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    });
    if (await realpath(directory) !== directory) throw new Error("会话目录不能是符号链接。");
    return new SessionStore(vault, directory);
  }

  get noteLockDirectory() { return this.directory; }

  private path(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("会话标识无效。");
    return join(this.directory, `${id}.json`);
  }

  async acquire(id: string, onLost = () => {}): Promise<() => Promise<void>> {
    const lease = { compromised: false };
    const release = await lock(this.path(id), { realpath: false, retries: 0, stale: 30000, update: 10000,
      onCompromised: () => { lease.compromised = true; onLost(); } });
    this.leases.set(id, lease);
    return async () => { try { await release(); } finally { this.leases.delete(id); } };
  }

  async save(id: string, manager: SessionManager) {
    const lease = this.leases.get(id);
    if (!lease || lease.compromised) throw new Error("会话未独占或占用锁已经失效。");
    const path = this.path(id);
    const header = manager.getHeader();
    if (!header || header.cwd !== this.cwd || header.id !== id) throw new Error("会话不属于当前笔记库。");
    const content = JSON.stringify({ version: 1, cwd: this.cwd, id, entries: [header, ...manager.getEntries()] });
    if (Buffer.byteLength(content) > 20 * 1024 * 1024) throw new Error("会话超过 20 MiB 存储限制。");
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    const file = await open(temporary, "wx", 0o600);
    try {
      try { await file.writeFile(content, "utf8"); await file.sync(); } finally { await file.close(); }
      if (lease.compromised) throw new Error("会话占用锁已经失效。");
      await rename(temporary, path);
    } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  }

  async load(id: string): Promise<SessionManager> {
    const file = await open(this.path(id), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error("会话文件无效或过大。");
      const content = await file.readFile("utf8");
      if (Buffer.byteLength(content) > 20 * 1024 * 1024) throw new Error("会话文件过大。");
      const data = JSON.parse(content);
      if (data.version !== 1 || data.cwd !== this.cwd || data.id !== id || !Array.isArray(data.entries) ||
          data.entries[0]?.type !== "session" || data.entries[0]?.cwd !== this.cwd || data.entries[0]?.id !== id) {
        throw new Error("会话文件不属于当前笔记库。");
      }
      return SessionManager.inMemory(this.cwd, undefined, data.entries as FileEntry[]);
    } finally { await file.close(); }
  }
}
