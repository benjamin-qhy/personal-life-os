import { RequestError, type AgentContext, type NewSessionRequest, type LoadSessionRequest, type PromptRequest, type SetSessionConfigOptionRequest, type SessionConfigOption } from "@agentclientprotocol/sdk";
import { SessionManager, type AgentSession } from "@earendil-works/pi-coding-agent";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { createPiSession } from "./pi-session";
import { readModelConfig } from "./config";
import { noteTools } from "./tools";
import { approveChange } from "./approval";
import { explicitMcpServers } from "./mcp-config";
import { connectMcp } from "./mcp";
import { promptText } from "./context";
import { SessionStore } from "./session-store";

interface Conversation { cwd: string; contextRoot: string; pi: AgentSession; active: boolean; invalid: boolean; cancelled: boolean; client?: AgentContext;
  closeMcp: () => Promise<void>; store: SessionStore; manager: SessionManager; release: () => Promise<void>; done?: Promise<void> }

export class Sessions {
  private readonly entries = new Map<string, Conversation>();

  async create(params: NewSessionRequest, restoreId?: string) {
    if (!isAbsolute(params.cwd)) throw RequestError.invalidParams(undefined, "工作目录必须是绝对路径。");
    let cwd: string;
    try {
      cwd = await realpath(params.cwd);
      if (!(await stat(cwd)).isDirectory()) throw new Error();
    } catch { throw RequestError.invalidParams(undefined, "工作目录不存在或不是目录。"); }
    try { readModelConfig(process.env); }
    catch (error) { throw RequestError.invalidParams(undefined, (error as Error).message); }
    const sessionId = restoreId ?? crypto.randomUUID();
    if (this.entries.has(sessionId)) throw RequestError.invalidParams(undefined, "会话已打开。");
    let invalid = false;
    let store: SessionStore, manager: SessionManager;
    let release: (() => Promise<void>) | undefined;
    try {
      store = await SessionStore.open(cwd, process.env.LIFE_OS_SESSION_DIR);
      release = await store.acquire(sessionId, () => {
        invalid = true;
        const entry = this.entries.get(sessionId);
        if (entry) { entry.invalid = true; void entry.pi.abort(); }
      });
      manager = restoreId ? await store.load(sessionId) : SessionManager.inMemory(cwd, { id: sessionId });
    } catch {
      await release?.();
      throw RequestError.invalidParams(undefined, "会话存储不可用或已被占用，请检查库外存储目录和会话标识。");
    }
    let mcp: Awaited<ReturnType<typeof connectMcp>>;
    try { mcp = await connectMcp(cwd, await explicitMcpServers(cwd, params.mcpServers, process.env)); }
    catch { await release(); throw RequestError.invalidParams(undefined, "MCP连接失败，请检查显式配置与服务。"); }
    let pi: AgentSession;
    try { pi = await createPiSession(cwd, process.env, { sessionManager: manager, tools: [...mcp.tools, ...noteTools(cwd, async (callId, change, signal) => {
      if (invalid) return false;
      const client = this.entries.get(sessionId)?.client;
      return client ? approveChange(sessionId, callId, change,
        (params) => client.request("session/request_permission", params), signal) : false;
    }, store.noteLockDirectory)] }); }
    catch { await mcp.close(); await release(); throw RequestError.authRequired(undefined, "模型初始化失败，请检查供应商、模型名称、服务地址与密钥环境变量。"); }
    try { await store.save(sessionId, manager); }
    catch { pi.dispose(); await mcp.close(); await release(); throw RequestError.internalError(undefined, "会话保存失败，请检查本机存储目录。"); }
    this.entries.set(sessionId, { cwd, contextRoot: params.cwd, closeMcp: mcp.close, pi, active: false, invalid, cancelled: false, store, manager, release });
    return { sessionId, configOptions: this.modelOptions(this.entries.get(sessionId)!) };
  }

  async load(params: LoadSessionRequest, client: AgentContext) {
    await this.create(params, params.sessionId);
    const entry = this.entries.get(params.sessionId)!;
    try {
      for (const message of entry.pi.messages) {
        if (message.role !== "user" && message.role !== "assistant") continue;
        const parts = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
        for (const part of parts) {
          if (part.type !== "text") continue;
          await client.notify("session/update", { sessionId: params.sessionId, update: {
            sessionUpdate: message.role === "user" ? "user_message_chunk" : "agent_message_chunk",
            content: { type: "text", text: part.text },
          } });
        }
      }
    } catch {
      entry.pi.dispose(); await entry.closeMcp(); await entry.release(); this.entries.delete(params.sessionId);
      throw RequestError.internalError(undefined, "会话历史恢复失败。");
    }
    return { configOptions: this.modelOptions(entry) };
  }

  private modelOptions(entry: Conversation): SessionConfigOption[] {
    const model = entry.pi.model!;
    return [{ id: "model", name: "模型", category: "model", type: "select", currentValue: model.id,
      options: entry.pi.modelRuntime.getModels(model.provider).filter(item => model.provider !== "openai-codex" || item.baseUrl === "https://chatgpt.com/backend-api")
        .map(item => ({ value: item.id, name: item.name })) }];
  }

  async setConfig(params: SetSessionConfigOptionRequest) {
    const entry = this.entries.get(params.sessionId);
    if (!entry || entry.invalid) throw RequestError.invalidParams(undefined, "会话不存在或占用锁已失效。");
    if (entry.active) throw RequestError.invalidParams(undefined, "当前会话正在回复，请先等待或取消。");
    if (params.configId !== "model" || typeof params.value !== "string") throw RequestError.invalidParams(undefined, "不支持该配置项。");
    const model = entry.pi.modelRuntime.getModel(entry.pi.model!.provider, params.value);
    if (!model || (model.provider === "openai-codex" && model.baseUrl !== "https://chatgpt.com/backend-api")) throw RequestError.invalidParams(undefined, "模型不在当前供应商可选列表中。");
    entry.active = true;
    const done = Promise.withResolvers<void>(); entry.done = done.promise;
    try {
      await entry.pi.setModel(model);
      await entry.store.save(params.sessionId, entry.manager);
      return { configOptions: this.modelOptions(entry) };
    } catch { throw RequestError.internalError(undefined, "模型切换或保存失败，请检查配置并重新打开会话。"); }
    finally { entry.active = false; done.resolve(); }
  }

  async prompt(params: PromptRequest, client: AgentContext) {
    const entry = this.entries.get(params.sessionId);
    if (!entry) throw RequestError.invalidParams(undefined, "会话不存在。");
    if (entry.invalid) throw RequestError.invalidParams(undefined, "会话占用锁已失效，请重新打开会话。");
    if (entry.active) throw RequestError.invalidParams(undefined, "当前会话正在回复，请先等待或取消。");
    entry.active = true; entry.cancelled = false;
    const done = Promise.withResolvers<void>(); entry.done = done.promise;
    entry.client = client;
    const sends: Promise<void>[] = [];
    const unsubscribe = entry.pi.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        const send = client.notify("session/update", { sessionId: params.sessionId, update: {
          sessionUpdate: "agent_message_chunk", content: { type: "text", text: event.assistantMessageEvent.delta },
        } });
        sends.push(send);
        void send.catch(() => entry.pi.abort());
      }
    });
    try {
      const text = await promptText(entry.cwd, params.prompt, entry.contextRoot);
      if (entry.cancelled) return { stopReason: "cancelled" as const };
      await entry.pi.prompt(text);
      await Promise.all(sends);
      if (entry.cancelled) return { stopReason: "cancelled" as const };
      const last = entry.pi.messages.at(-1);
      if (last?.role === "assistant" && last.stopReason === "error") {
        throw new Error("模型请求失败");
      }
      if (last?.role === "assistant" && last.stopReason === "length") {
        return { stopReason: "max_tokens" as const };
      }
      return { stopReason: "end_turn" as const };
    } catch (error) {
      if (error instanceof RequestError) throw error;
      if (entry.cancelled) return { stopReason: "cancelled" as const };
      throw RequestError.internalError(undefined, "模型请求失败，请检查服务连接、模型配置与额度。");
    } finally {
      unsubscribe();
      try { await entry.store.save(params.sessionId, entry.manager); }
      catch { throw RequestError.internalError(undefined, "会话保存失败，本次消息可能无法恢复。"); }
      finally { entry.active = false; delete entry.client; done.resolve(); }
    }
  }

  async cancel(sessionId: string) {
    const entry = this.entries.get(sessionId);
    if (entry?.active) { entry.cancelled = true; await entry.pi.abort(); }
  }

  async dispose() {
    for (const entry of this.entries.values()) {
      entry.cancelled = true;
      await entry.pi.abort(); await entry.done; entry.pi.dispose(); await entry.closeMcp(); await entry.release();
    }
    this.entries.clear();
  }
}
