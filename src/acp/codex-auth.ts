import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CredentialStore, OAuthCredential } from "@earendil-works/pi-ai";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

/** 只提取现有会话的访问令牌；不刷新、不修改 Codex 登录文件。 */
export function parseCodexAccessToken(value: unknown, now = Date.now()): string {
  const auth = record(value);
  const token = record(auth?.tokens)?.access_token;
  if (auth?.auth_mode !== "chatgpt" || typeof token !== "string") {
    throw new Error("未找到 Codex 的 ChatGPT 订阅登录，请先在 Codex 中登录。");
  }
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) throw new Error();
    const payload = record(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")));
    const accountId = record(payload?.["https://api.openai.com/auth"])?.chatgpt_account_id;
    if (typeof payload?.exp !== "number" || !Number.isFinite(payload.exp) ||
        payload.exp * 1000 <= now + 300_000 || typeof accountId !== "string" || !accountId) throw new Error();
    return token;
  } catch {
    throw new Error("Codex 登录已失效、即将过期或格式不受支持，请先在 Codex 中重新登录。");
  }
}

export function parseCodexCredential(value: unknown, now = Date.now()): OAuthCredential {
  const access = parseCodexAccessToken(value, now);
  const payload = JSON.parse(Buffer.from(access.split(".")[1]!, "base64url").toString("utf8"));
  return { type: "oauth", access, refresh: "", expires: payload.exp * 1000,
    accountId: payload["https://api.openai.com/auth"].chatgpt_account_id };
}

export async function readCodexCredential(env: Record<string, string | undefined>): Promise<OAuthCredential> {
  const path = join(env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
  let auth: unknown;
  try { auth = JSON.parse(await readFile(path, "utf8")); }
  catch { throw new Error("无法读取 Codex 本机登录，请先在 Codex 中完成登录。"); }
  return parseCodexCredential(auth);
}

/** 防止 Pi 的自动 OAuth 刷新改动另一个客户端管理的共享登录。 */
export function codexCredentialStore(credential: OAuthCredential, now = Date.now): CredentialStore {
  return {
    async read(provider) {
      if (provider !== "openai-codex") return undefined;
      if (credential.expires <= now() + 300_000) throw new Error("Codex 登录即将过期，请在 Codex 中重新登录后创建新会话。");
      return { ...credential };
    },
    async list() { return [{ providerId: "openai-codex", type: "oauth" }]; },
    async modify() { throw new Error("Codex 共享凭据只读，不允许自动刷新或修改。"); },
    async delete() { throw new Error("Codex 共享凭据只读，不允许删除。"); },
  };
}
