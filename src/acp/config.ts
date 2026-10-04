export interface ModelConfig {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKeyEnv: string;
  auth: "api-key" | "codex";
}

export function readModelConfig(env: Record<string, string | undefined>): ModelConfig {
  const provider = env.LIFE_OS_PROVIDER?.trim();
  const model = env.LIFE_OS_MODEL?.trim();
  if (!provider) throw new Error("请设置 LIFE_OS_PROVIDER 模型供应商。");
  if (!model) throw new Error("请设置 LIFE_OS_MODEL 模型名称。");
  const auth = env.LIFE_OS_AUTH?.trim() || "api-key";
  if (auth !== "api-key" && auth !== "codex") throw new Error("LIFE_OS_AUTH 仅支持 api-key 或 codex。");
  if (auth === "codex" && (provider !== "openai-codex" || env.LIFE_OS_BASE_URL?.trim())) {
    throw new Error("Codex 订阅认证仅限 openai-codex 官方服务，不接受自定义服务地址。");
  }
  const apiKeyEnv = env.LIFE_OS_API_KEY_ENV?.trim() || "LIFE_OS_API_KEY";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnv)) {
    throw new Error("LIFE_OS_API_KEY_ENV 必须是环境变量名。");
  }
  const baseUrl = env.LIFE_OS_BASE_URL?.trim();
  if (!baseUrl) return { provider, model, apiKeyEnv, auth };
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error("模型服务地址无效。"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error("模型服务地址必须使用 HTTPS；本机服务可以使用 HTTP，地址不能包含凭据、查询或片段。");
  }
  return { provider, model, baseUrl, apiKeyEnv, auth };
}
