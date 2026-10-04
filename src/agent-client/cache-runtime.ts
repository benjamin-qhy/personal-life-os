// Injected into the pinned Agent Client desktop build. Node modules load only
// after the generated plugin's desktop guard. Original UI calls this seam.
import type * as Fs from "node:fs/promises";
import type * as Path from "node:path";
import type * as Crypto from "node:crypto";
import { privateWindowsAcl, privateWindowsAcls } from "./windows-acl";

export interface SessionRow {
  sessionId: string;
  agentId: string;
  cwd?: string;
  title?: string;
  embedId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
interface CacheIndex { version: 1; sessions: SessionRow[]; deleting?: string[] }
interface Message { timestamp: Date; [key: string]: unknown }
interface SettingsState {
  savedSessions: SessionRow[];
  debugMode: boolean;
  windowsWslMode: boolean;
  autoAllowPermissions: boolean;
  exportSettings: Record<string, unknown>;
  [key: string]: unknown;
}
interface PluginHost {
  app: { vault: { adapter: { getBasePath(): string } } };
  settings: SettingsState;
  lifeOsCache?: Cache;
  saveData(value: Record<string, unknown>): Promise<void>;
}
interface UpstreamHooks {
  normalizeCwd(cwd: string, settings: SettingsState): string;
  trim(rows: SessionRow[]): void;
  debug(enabled: boolean): void;
}
const queues = new Map<string, Promise<unknown>>();
function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(run);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
  return next;
}
function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw Error("会话缓存数据格式损坏");
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw Error("会话缓存：非法会话 ID");
  return value;
}
function sessionRow(value: unknown): SessionRow {
  const row = record(value);
  const sessionId = id(row.sessionId);
  if (typeof row.agentId !== "string") throw Error("会话缓存索引损坏，拒绝覆盖");
  for (const key of ["cwd", "title", "embedId", "createdAt", "updatedAt"]) {
    if (row[key] !== undefined && typeof row[key] !== "string") throw Error("会话缓存索引损坏，拒绝覆盖");
  }
  return { ...row, sessionId, agentId: row.agentId } as SessionRow;
}

export class Cache {
  private fs!: typeof Fs;
  private path!: typeof Path;
  private crypto!: typeof Crypto;
  private dir = "";
  private vault = "";
  private windows = process.platform === "win32";
  private aclTransaction = false;
  private directoryAclVerified = false;
  constructor(private plugin: PluginHost) {}

  async init(): Promise<CacheIndex> {
    this.fs = require("node:fs/promises") as typeof Fs;
    this.path = require("node:path") as typeof Path;
    this.crypto = require("node:crypto") as typeof Crypto;
    const home = (require("node:os") as typeof import("node:os")).homedir();
    this.vault = await this.fs.realpath(this.plugin.app.vault.adapter.getBasePath());
    await this.checkParents(home);
    this.dir = this.path.join(home, ".local", "share", "personal-life-os", "agent-client", this.crypto.createHash("sha256").update(this.vault).digest("hex"));
    if (this.inside(this.dir)) throw Error("会话缓存不能位于笔记库内");
    let current = this.path.parse(this.dir).root;
    for (const part of this.dir.slice(current.length).split(this.path.sep).filter(Boolean)) {
      current = this.path.join(current, part);
      try { await this.fs.mkdir(current, { mode: 0o700 }); if (this.windows && this.privateDirectory(current)) await privateWindowsAcl(current, true); }
      catch (error) { if (!isErrorCode(error, "EEXIST")) throw error; }
      await this.checkDirectory(current);
    }
    if (this.inside(await this.fs.realpath(this.dir))) throw Error("会话缓存不能位于笔记库内");
    return this.transact(async index => index);
  }
  private inside(path: string): boolean {
    const relative = this.path.relative(this.vault, path);
    return relative === "" || (!relative.startsWith(".." + this.path.sep) && relative !== ".." && !this.path.isAbsolute(relative));
  }
  private privateDirectory(path: string): boolean {
    return !!this.dir && [this.dir, this.path.dirname(this.dir), this.path.dirname(this.path.dirname(this.dir))].includes(path);
  }
  private async checkDirectory(path: string, skipWindowsAcl = false): Promise<void> {
    const stats = await this.fs.lstat(path);
    if (stats.isSymbolicLink() || !stats.isDirectory()) throw Error("会话缓存路径不允许符号链接或非目录");
    if (this.privateDirectory(path)) {
      if (this.windows) { if (!skipWindowsAcl) await privateWindowsAcl(path, false); return; }
      if ((stats.mode & 0o077) !== 0) throw Error("会话缓存目录权限必须为 0700");
      if (typeof process.getuid === "function" && stats.uid !== process.getuid()) throw Error("会话缓存目录所有者不匹配");
    }
  }
  private async checkParents(path: string): Promise<void> {
    let current = this.path.parse(path).root;
    const privatePaths: {path: string; create: boolean}[] = [];
    for (const part of path.slice(current.length).split(this.path.sep).filter(Boolean)) {
      current = this.path.join(current, part);
      await this.checkDirectory(current, this.windows);
      if (this.windows && this.privateDirectory(current)) privatePaths.push({path: current, create: false});
    }
    if (privatePaths.length && !(this.aclTransaction && this.directoryAclVerified)) {
      await privateWindowsAcls(privatePaths);
      if (this.aclTransaction) this.directoryAclVerified = true;
    }
  }
  private sessionFile(sessionId: string): string {
    return `session-${this.crypto.createHash("sha256").update(id(sessionId)).digest("hex")}.json`;
  }
  private file(name: string): string { return this.path.join(this.dir, name); }
  private async read(name: string): Promise<string | null> {
    await this.checkParents(this.dir);
    let handle: Fs.FileHandle | undefined;
    try {
      const constants = (require("node:fs") as typeof import("node:fs")).constants;
      // Windows O_NOFOLLOW is not portable; reject its reparse points through
      // both lstat and the ACL query before opening the private file.
      const before = await this.fs.lstat(this.file(name));
      if (before.isSymbolicLink() || !before.isFile()) throw Error("会话缓存文件类型不安全");
      if (this.windows) await privateWindowsAcl(this.file(name), false);
      handle = await this.fs.open(this.file(name), constants.O_RDONLY | constants.O_NOFOLLOW);
      const stats = await handle.stat();
      if (!stats.isFile() || stats.nlink !== 1 || (!this.windows && (stats.mode & 0o077) !== 0) || before.ino !== stats.ino || before.dev !== stats.dev) throw Error("会话缓存文件权限或类型不安全");
      if (!this.windows && typeof process.getuid === "function" && stats.uid !== process.getuid()) throw Error("会话缓存文件所有者不匹配");
      return await handle.readFile("utf8");
    } catch (error) {
      if (isErrorCode(error, "ENOENT")) return null;
      throw error;
    } finally { await handle?.close(); }
  }
  private async write(name: string, value: unknown): Promise<void> {
    await this.checkParents(this.dir);
    await this.read(name);
    const temp = this.file(`.tmp-${this.crypto.randomUUID()}`);
    let handle: Fs.FileHandle | undefined;
    try {
      handle = await this.fs.open(temp, "wx", 0o600);
      if (this.windows) await privateWindowsAcl(temp, true);
      await handle.writeFile(JSON.stringify(value));
      await handle.sync();
      await handle.close();
      handle = undefined;
      await this.checkParents(this.dir);
      await this.fs.rename(temp, this.file(name));
    } finally {
      await handle?.close();
      await this.fs.unlink(temp).catch((error: unknown) => { if (!isErrorCode(error, "ENOENT")) throw error; });
    }
  }
  async readIndex(): Promise<CacheIndex> {
    const text = await this.read("index.json");
    if (text === null) return { version: 1, sessions: [] };
    const value = record(JSON.parse(text) as unknown);
    if (value.version !== 1 || !Array.isArray(value.sessions)) throw Error("会话缓存索引损坏，拒绝覆盖");
    const rows = value.sessions.map(sessionRow);
    if (new Set(rows.map(row => row.sessionId)).size !== rows.length) throw Error("会话缓存索引损坏，拒绝覆盖");
    if (value.deleting !== undefined && !Array.isArray(value.deleting)) throw Error("会话缓存删除标记损坏");
    const deleting = (value.deleting as unknown[] | undefined)?.map(id);
    if (deleting?.some(session => rows.some(row => row.sessionId === session))) throw Error("会话缓存删除标记与索引冲突");
    return { version: 1, sessions: rows, ...(deleting ? { deleting } : {}) };
  }
  async transact<T>(run: (index: CacheIndex) => Promise<T>): Promise<T> {
    return serial(this.dir, async () => {
      await this.checkParents(this.dir);
      const lock = this.file(".lock");
      let acquired = false;
      for (let attempt = 0; attempt < (this.windows ? 1800 : 100); attempt++) {
        try { await this.fs.mkdir(lock, { mode: 0o700 }); acquired = true; break; }
        catch (error) {
          if (!isErrorCode(error, "EEXIST")) throw error;
          try {
            const stats = await this.fs.lstat(lock);
            if (stats.isSymbolicLink() || !stats.isDirectory()) throw Error("会话缓存锁不安全");
          } catch (lockError) {
            // The previous holder may remove the directory between mkdir and
            // lstat. Retry acquisition rather than treating that as failure.
            if (isErrorCode(lockError, "ENOENT")) continue;
            throw lockError;
          }
          await new Promise(resolve => setTimeout(resolve, this.windows ? 100 : 10));
        }
      }
      if (!acquired) throw Error("会话缓存正在使用或遗留锁需要人工检查");
      this.aclTransaction = true;
      this.directoryAclVerified = false;
      try {
        const index = await this.readIndex();
        if (index.deleting?.length) {
          for (const session of index.deleting) await this.deleteMessages(session);
          delete index.deleting;
          await this.write("index.json", index);
        }
        return await run(index);
      }
      finally { this.aclTransaction = false; this.directoryAclVerified = false; await this.fs.rmdir(lock); }
    });
  }
  async update(update: (rows: SessionRow[]) => void): Promise<SessionRow[]> {
    return this.transact(async index => {
      update(index.sessions);
      index.sessions = index.sessions.map(sessionRow);
      await this.write("index.json", index);
      return index.sessions;
    });
  }
  async messages(sessionId: string): Promise<Message[] | null> {
    const text = await this.read(this.sessionFile(sessionId));
    if (text === null) return null;
    const value = record(JSON.parse(text) as unknown);
    if (value.version !== 1 || value.sessionId !== sessionId || !Array.isArray(value.messages)) throw Error("会话缓存正文损坏");
    return value.messages.map((entry: unknown) => {
      const message = record(entry);
      if (typeof message.timestamp !== "string" || !Number.isFinite(Date.parse(message.timestamp))) throw Error("会话缓存正文日期损坏");
      return { ...message, timestamp: new Date(message.timestamp) };
    });
  }
  async saveMessages(sessionId: string, agentId: string, messages: Message[]): Promise<void> {
    id(sessionId);
    await this.transact(async () => {
      await this.write(this.sessionFile(sessionId), {
        version: 1, sessionId, agentId,
        messages: messages.map(message => ({ ...message, timestamp: message.timestamp.toISOString() })),
      });
    });
  }
  async deleteMessages(sessionId: string): Promise<void> {
    const name = this.sessionFile(sessionId);
    await this.read(name);
    await this.fs.unlink(this.file(name)).catch((error: unknown) => { if (!isErrorCode(error, "ENOENT")) throw error; });
  }
  async remove(sessionId: string): Promise<SessionRow[]> {
    id(sessionId);
    return this.transact(async index => {
      // One atomic index commit records the delete intent. If removal is
      // interrupted, the next locked load completes it before exposing rows.
      index.sessions = index.sessions.filter(row => row.sessionId !== sessionId);
      index.deleting = [sessionId];
      await this.write("index.json", index);
      try {
        await this.deleteMessages(sessionId);
        delete index.deleting;
        await this.write("index.json", index);
      } catch (error) {
        throw new Error("会话删除尚未完成；修复存储错误后重新打开，将继续已请求的删除", { cause: error });
      }
      return index.sessions;
    });
  }
}

export async function load(plugin: PluginHost, legacy: unknown): Promise<SessionRow[]> {
  if (legacy !== undefined && (!Array.isArray(legacy) || legacy.length)) {
    const message = "发现旧会话索引：未迁移、未读取或删除旧聊天。请先另行安排迁移；缓存停止加载，避免覆盖旧索引。";
    const Notice = (require("obsidian") as {Notice: new (text: string) => unknown}).Notice;
    new Notice(message);
    throw Error(message);
  }
  const cache = new Cache(plugin);
  plugin.lifeOsCache = cache;
  return (await cache.init()).sessions;
}
export function safeSettings(value: SettingsState): Omit<SettingsState, "savedSessions"> {
  const { savedSessions: _ignored, ...settings } = value;
  return { ...settings, autoAllowPermissions: false, exportSettings: { ...settings.exportSettings, autoExportOnNewChat: false, autoExportOnCloseChat: false } };
}
const reportedFailures = new WeakSet<object>();
export function reportFailure(error: unknown): void {
  if (typeof error === "object" && error !== null) {
    if (reportedFailures.has(error)) return;
    reportedFailures.add(error);
  }
  const Notice = (require("obsidian") as { Notice: new (text: string) => unknown }).Notice;
  new Notice("缓存操作失败，未确认保存。请检查库外目录权限、可用空间和索引后重试。" + (error instanceof Error ? ` ${error.message}` : ""));
}
export class Settings {
  state: SettingsState;
  listeners = new Set<() => void>();
  sessionStorage: Storage;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(initial: SettingsState, public plugin: PluginHost, public hooks: UpstreamHooks) {
    this.state = initial;
    this.sessionStorage = new Storage(plugin, this);
  }
  getSnapshot = (): SettingsState => this.state;
  subscribe = (listener: () => void): (() => boolean) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  publish(rows: SessionRow[]): void {
    this.state = { ...this.state, savedSessions: rows };
    this.plugin.settings = this.state;
    for (const listener of this.listeners) listener();
  }
  async updateSettings(patch: Partial<SettingsState>): Promise<void> {
    const run = this.queue.catch(() => {}).then(async () => {
      // A UI may submit an old full settings snapshot. Session mutations use
      // Cache.update instead, so this save never persists that old index.
      const next = { ...this.state, ...patch, ...safeSettings({ ...this.state, ...patch }), savedSessions: this.state.savedSessions };
      await this.plugin.saveData(safeSettings(next));
      this.state = { ...next, savedSessions: this.state.savedSessions };
      this.plugin.settings = this.state;
      this.hooks.debug(this.state.debugMode);
      for (const listener of this.listeners) listener();
    });
    this.queue = run;
    return run;
  }
  set(patch: Partial<SettingsState>): Promise<void> { return this.updateSettings(patch); }
  private async withNotice<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); } catch (error) { reportFailure(error); throw error; }
  }
  async persistSessionMessages(session: string, agent: string, messages: Message[], onSaved: () => void): Promise<boolean> {
    try {
      await this.saveSessionMessages(session, agent, messages);
      await this.updateSession(session, { updatedAt: new Date().toISOString() });
      onSaved();
      return true;
    } catch (error) { reportFailure(error); return false; }
  }
  saveSession(row: SessionRow) { return this.withNotice(() => this.sessionStorage.saveSession(row)); }
  getSavedSessions(agent?: string, cwd?: string) { return this.sessionStorage.getSavedSessions(agent, cwd); }
  getSavedSessionByEmbedId(embed: string) { return this.sessionStorage.getSavedSessionByEmbedId(embed); }
  deleteSession(session: string) { return this.withNotice(() => this.sessionStorage.deleteSession(session)); }
  updateSessionTitle(session: string, title: string, meta?: Pick<SessionRow, "agentId" | "cwd">) { return this.withNotice(() => this.sessionStorage.updateSessionTitle(session, title, meta)); }
  updateSession(session: string, patch: Partial<SessionRow>) { return this.withNotice(() => this.sessionStorage.updateSession(session, patch)); }
  saveSessionMessages(session: string, agent: string, messages: Message[]) { return this.withNotice(() => this.sessionStorage.saveSessionMessages(session, agent, messages)); }
  loadSessionMessages(session: string) { return this.withNotice(() => this.sessionStorage.loadSessionMessages(session)); }
  deleteSessionMessages(session: string) { return this.withNotice(() => this.sessionStorage.deleteSessionMessages(session)); }
}
export class Storage {
  constructor(private plugin: PluginHost, private settings: Settings) {}
  private get cache(): Cache {
    if (!this.plugin.lifeOsCache) throw Error("会话缓存尚未初始化");
    return this.plugin.lifeOsCache;
  }
  async saveSession(value: SessionRow): Promise<void> {
    const row = sessionRow(value);
    if (row.cwd) row.cwd = this.settings.hooks.normalizeCwd(row.cwd, this.settings.state);
    const rows = await this.cache.update(rows => {
      const position = rows.findIndex(candidate => candidate.sessionId === row.sessionId);
      if (position < 0) { rows.unshift(row); this.settings.hooks.trim(rows); }
      else rows[position] = row;
    });
    this.settings.publish(rows);
  }
  getSavedSessions(agent?: string, cwd?: string): SessionRow[] {
    const normalized = cwd ? this.settings.hooks.normalizeCwd(cwd, this.settings.state) : cwd;
    return [...this.settings.state.savedSessions]
      .filter(row => (!agent || row.agentId === agent) && (!normalized || row.cwd === normalized))
      .sort((a, b) => new Date(b.updatedAt ?? "").getTime() - new Date(a.updatedAt ?? "").getTime());
  }
  getSavedSessionByEmbedId(embed: string): SessionRow | undefined { return this.getSavedSessions().find(row => row.embedId === embed); }
  async updateSessionTitle(session: string, title: string, meta?: Pick<SessionRow, "agentId" | "cwd">): Promise<void> {
    id(session);
    const rows = await this.cache.update(rows => {
      const row = rows.find(candidate => candidate.sessionId === session);
      if (row) row.title = title;
      else if (meta) {
        rows.unshift({ ...meta, sessionId: session, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        this.settings.hooks.trim(rows);
      }
    });
    this.settings.publish(rows);
  }
  async updateSession(session: string, patch: Partial<SessionRow>): Promise<void> {
    id(session);
    if (patch.sessionId !== undefined && patch.sessionId !== session) throw Error("不能修改会话 ID");
    const rows = await this.cache.update(rows => {
      const row = rows.find(candidate => candidate.sessionId === session);
      if (row) Object.assign(row, patch, { updatedAt: patch.updatedAt ?? new Date().toISOString() });
    });
    this.settings.publish(rows);
  }
  async deleteSession(session: string): Promise<void> { this.settings.publish(await this.cache.remove(session)); }
  saveSessionMessages(session: string, agent: string, messages: Message[]) { return this.cache.saveMessages(session, agent, messages); }
  loadSessionMessages(session: string) { return this.cache.messages(session); }
  deleteSessionMessages(session: string) { return this.cache.transact(() => this.cache.deleteMessages(session)); }
}
