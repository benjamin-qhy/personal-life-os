#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import {
  buildTemplate,
  BuildVerificationError,
} from "../src/tooling/build-template";
try {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", short: "h" },
      live: { type: "string" },
      out: { type: "string" },
      name: { type: "string" },
      version: { type: "string" },
      zip: { type: "boolean" },
      "without-reading": { type: "boolean" },
    },
  });
  if (values.help) {
    console.log("用法：bun scripts/build_template.ts --version X.Y.Z [--live 源目录] [--out 输出目录] [--name Personal-Life-OS] [--zip] [--without-reading]\n只在库外全新目标构建脱敏候选版本。");
    process.exit(0);
  }
  if (!values.version) throw new Error("Version required");
  const live = values.live ?? resolve(import.meta.dir, "..");
  const result = await buildTemplate({
    live,
    out: values.out ?? resolve(import.meta.dir, "../../life-os-releases"),
    name: values.name,
    version: values.version,
    zip: values.zip,
    withoutReading: values["without-reading"],
  });
  console.log(`已验证的本地候选版本： ${result.destination}`);
  if (result.archive) console.log(`本地归档： ${result.archive}`);
} catch (error) {
  if (error instanceof BuildVerificationError)
    console.error("未通过的检查：" + error.checks.join("、"));
  console.error("构建已安全停止。请检查目标是否全新、输入文件和访问权限。");
  process.exitCode = 1;
}
