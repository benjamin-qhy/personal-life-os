// 仅使用合成数据验证发行安全，不读取个人笔记或调用模型。
import { resolve } from "node:path";
const root = resolve(import.meta.dir, "..");
const child = Bun.spawn([process.execPath, "test", "tests/tooling/build-template.test.ts", "tests/tooling/archive.test.ts", "tests/tooling/verify-template.test.ts"], {
  cwd: root, stdin: "ignore", stdout: "inherit", stderr: "inherit",
});
process.exitCode = await child.exited;
