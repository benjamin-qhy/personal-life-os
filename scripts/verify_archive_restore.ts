import { verifyArchive } from "../src/tooling/archive";
if (import.meta.main) {
  try {
    const archive = process.argv[2]; if (!archive) throw new Error("请指定候选 ZIP。");
    const { digest, count } = await verifyArchive(archive);
    console.log(`通过：临时恢复的 ${count} 个文件与嵌入清单一致；SHA256 ${digest}`);
    console.log("临时目录已删除；此检查不代表个人备份恢复或 Obsidian 原生功能已验收。");
  } catch { console.error("归档恢复验证失败，请检查归档路径、校验文件和文件完整性。"); process.exitCode = 1; }
}
