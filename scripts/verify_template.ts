import { verifyTemplate } from "../src/tooling/verify-template";
if (import.meta.main) {
  try {
    const root = process.argv[2]; if (!root || root.startsWith("--")) throw new Error();
    const results = await verifyTemplate(root);
    if (process.argv.includes("--json")) console.log(JSON.stringify(results, null, 2));
    else {
      for (const result of results) if (!result.ok) console.error(`未通过：${result.check}${result.detail ? `（${result.detail}）` : ""}`);
      console.log(`${results.filter(r => r.ok).length} 项通过，${results.filter(r => !r.ok).length} 项失败`);
    }
    if (results.some(r => !r.ok)) process.exitCode = 1;
  } catch { console.error("验证失败，请指定已脱敏候选目录并检查文件结构。"); process.exitCode = 1; }
}
