import { expect, test } from "bun:test";
import { codexCredentialStore, parseCodexAccessToken, parseCodexCredential } from "../../src/acp/codex-auth";
import { readModelConfig } from "../../src/acp/config";

const now = 1_800_000_000_000;
function login(expires: number) {
  const token = `synthetic.${Buffer.from(JSON.stringify({ exp: expires,
    "https://api.openai.com/auth": { chatgpt_account_id: "synthetic-account" },
  })).toString("base64url")}.synthetic`;
  return { auth_mode: "chatgpt", tokens: { access_token: token, refresh_token: "NEVER_COPY_REFRESH" } };
}

test("Codex 认证只提取有效访问令牌，不复制刷新令牌", () => {
  const auth = login(now / 1000 + 3600);
  const token = parseCodexAccessToken(auth, now);
  expect(token).toBe(auth.tokens.access_token);
  expect(token).not.toContain("NEVER_COPY_REFRESH");
  const credential = parseCodexCredential(auth, now);
  expect(credential.type).toBe("oauth");
  expect(credential.refresh).toBe("");
  expect(credential.expires).toBe(now + 3600000);
  expect(JSON.stringify(credential)).not.toContain("NEVER_COPY_REFRESH");
});

test.each([login(now / 1000 - 1), login(now / 1000 + 10), {},
  { auth_mode: "apikey", tokens: { access_token: "SECRET_SENTINEL" } },
  { auth_mode: "chatgpt", tokens: { access_token: "SECRET_SENTINEL" } },
])("无效或即将过期的认证给出不含凭据的错误 %#", (auth) => {
  try { parseCodexAccessToken(auth, now); throw new Error("应拒绝"); }
  catch (error) {
    expect((error as Error).message).toContain("Codex");
    expect((error as Error).message).not.toContain("SECRET_SENTINEL");
  }
});

test.each([
  { LIFE_OS_PROVIDER: "custom", LIFE_OS_MODEL: "model", LIFE_OS_AUTH: "codex" },
  { LIFE_OS_PROVIDER: "openai-codex", LIFE_OS_MODEL: "model", LIFE_OS_AUTH: "codex",
    LIFE_OS_BASE_URL: "https://example.com/v1" },
])("Codex 登录不能用于其他供应商或自定义地址 %#", (env) => {
  expect(() => readModelConfig(env)).toThrow("Codex");
});

test("认证方式必须显式配置为已支持的值", () => {
  expect(() => readModelConfig({ LIFE_OS_PROVIDER: "custom", LIFE_OS_MODEL: "test",
    LIFE_OS_AUTH: "unexpected" })).toThrow("LIFE_OS_AUTH");
});

test("共享 Codex 凭据只读，拒绝刷新和删除", async () => {
  const store = codexCredentialStore(parseCodexCredential(login(now / 1000 + 3600), now), () => now);
  expect((await store.read("openai-codex"))?.type).toBe("oauth");
  expect(await store.read("other-provider")).toBeUndefined();
  let refreshed = false;
  await expect(store.modify("openai-codex", async () => { refreshed = true; return undefined; }))
    .rejects.toThrow("Codex");
  expect(refreshed).toBe(false);
  await expect(store.delete("openai-codex")).rejects.toThrow("Codex");
});

test("长会话中令牌即将过期时停止使用，而不启动刷新", async () => {
  let clock = now;
  const store = codexCredentialStore(parseCodexCredential(login(now / 1000 + 3600), now), () => clock);
  clock += 3400000;
  await expect(store.read("openai-codex")).rejects.toThrow("过期");
});
