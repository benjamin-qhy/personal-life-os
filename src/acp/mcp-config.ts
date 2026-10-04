import type { McpServer } from "@agentclientprotocol/sdk";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 64 || value.some(item => typeof item !== "string" || item.length > 4096)) throw new Error();
  return value as string[];
}
function variables(value: unknown, env: Record<string, string | undefined>) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) throw new Error();
  return value.map(item => {
    const entry = object(item);
    if (typeof entry.name !== "string" || !entry.name || typeof entry.valueEnv !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.valueEnv) || "value" in entry || env[entry.valueEnv] === undefined) throw new Error();
    return { name: entry.name, value: env[entry.valueEnv]! };
  });
}

export async function explicitMcpServers(cwd: string, supplied: McpServer[], env: Record<string, string | undefined>): Promise<McpServer[]> {
  if (supplied.length || !env.LIFE_OS_MCP_CONFIG) return supplied;
  try {
    const filename = env.LIFE_OS_MCP_CONFIG;
    if (!isAbsolute(filename)) throw new Error();
    const actual = await realpath(filename);
    const distance = relative(await realpath(cwd), actual);
    if (!distance || (distance !== ".." && !distance.startsWith(".." + sep) && !isAbsolute(distance))) throw new Error();
    const file = await open(actual, constants.O_RDONLY | constants.O_NOFOLLOW);
    let config: Record<string, unknown>;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 64 * 1024) throw new Error();
      const text = await file.readFile("utf8");
      if (Buffer.byteLength(text) > 64 * 1024) throw new Error();
      config = object(JSON.parse(text));
    } finally { await file.close(); }
    if (!Array.isArray(config.mcpServers) || config.mcpServers.length > 4) throw new Error();
    return config.mcpServers.map(value => {
      const server = object(value);
      if (typeof server.name !== "string") throw new Error();
      if (server.type === "http") {
        if (typeof server.url !== "string") throw new Error();
        return { type: "http", name: server.name, url: server.url, headers: variables(server.headers, env) };
      }
      if (server.type !== undefined && server.type !== "stdio") throw new Error();
      if (typeof server.command !== "string") throw new Error();
      return { name: server.name, command: server.command, args: strings(server.args ?? []), env: variables(server.env, env) };
    });
  } catch { throw new Error("LIFE_OS_MCP_CONFIG 必须指向库外有效JSON配置；认证只能引用已设置的环境变量。未回退为自动发现。"); }
}
