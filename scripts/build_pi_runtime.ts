import { compilePiRuntime } from "../src/tooling/build-pi-runtime";
import { mkdir, lstat, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
try {
  const code = await compilePiRuntime();
  let folder = root;
  for (const part of ["dist", "ai-runtime"]) {
    folder = join(folder, part);
    await mkdir(folder).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
    const info = await lstat(folder);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("输出目录不安全。");
  }
  const temporary = join(folder, `.pi-acp-${crypto.randomUUID()}.tmp`);
  try { await writeFile(temporary, code, { flag: "wx" }); await rename(temporary, join(folder, "pi-acp.js")); }
  finally { await rm(temporary, { force: true }); }
  console.log("Pi ACP 已生成到 dist/ai-runtime/pi-acp.js，仅运行时需要 Bun 和模型配置。");
} catch (error) { console.error("Pi ACP 构建失败：", error instanceof Error ? error.message : "未知错误"); process.exitCode = 1; }
