import { expect, test } from "bun:test";
import { readModelConfig } from "../../src/acp/config";

test("缺少配置时给出中文提示，不回显环境变量值", () => {
  expect(() => readModelConfig({ SECRET: "不应泄露" })).toThrow("LIFE_OS_PROVIDER");
});

test("自定义服务只保存密钥变量名，不将密钥复制到配置", () => {
  const config = readModelConfig({
    LIFE_OS_PROVIDER: "custom", LIFE_OS_MODEL: "test-model",
    LIFE_OS_BASE_URL: "https://example.com/v1",
    LIFE_OS_API_KEY_ENV: "TEST_KEY", TEST_KEY: "不应泄露",
  });
  expect(config.apiKeyEnv).toBe("TEST_KEY");
  expect(JSON.stringify(config)).not.toContain("不应泄露");
});

test.each(["http://example.com/v1", "https://user:secret@example.com/v1", "file:///tmp/model"])(
  "拒绝不合适的服务地址 %s", (baseUrl) => {
    expect(() => readModelConfig({
      LIFE_OS_PROVIDER: "custom", LIFE_OS_MODEL: "model", LIFE_OS_BASE_URL: baseUrl,
    })).toThrow("服务地址");
  },
);

test("允许本机 HTTP 模拟服务", () => {
  expect(readModelConfig({ LIFE_OS_PROVIDER: "custom", LIFE_OS_MODEL: "test",
    LIFE_OS_BASE_URL: "http://127.0.0.1:1234/v1" }).baseUrl).toBe("http://127.0.0.1:1234/v1");
});
