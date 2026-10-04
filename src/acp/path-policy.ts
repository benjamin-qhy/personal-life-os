// Semantic aliases are used only for permission checks. Never rewrite an input
// path: old and new files may coexist and must remain distinct approval targets.
export const policyPath = (path: string) => path.normalize("NFC").toLowerCase();
const sectionFolders = new Set(["04 projects", "04 项目", "05 people", "05 人物", "06 writing", "06 写作", "07 library", "07 书库"]);
const rootFolder = (path: string) => policyPath(path.split("/")[0] ?? "");
export const canPatchSection = (path: string) => sectionFolders.has(rootFolder(path));
const taskFolders = new Set(["08 tasks", "08 任务"]);
const taskFiles = new Set(["tasks.md", "任务总表.md"]);
export const isTaskDirectory = (path: string) => taskFolders.has(rootFolder(path));
export function isTaskMaster(path: string): boolean {
  const parts = policyPath(path).split("/");
  return parts.length === 2 && taskFolders.has(parts[0]!) && taskFiles.has(parts[1]!);
}
const protectedFolders = new Set([
  "wiki", "inbox", "docs", "scripts",
  "templates", "模板", "prompts", "提示词", "meta", "系统", "guide", "使用指南",
  "00 dashboards", "00 仪表盘", "09 reading", "09 阅读",
]);
const protectedFiles = new Set(["agents.md", "context.md", "readme.md"]);
export function forbidsDirectWrite(path: string): boolean {
  return protectedFolders.has(rootFolder(path)) || protectedFiles.has(policyPath(path.split("/").at(-1) ?? ""));
}
const boardFolders = new Set(["04 projects", "04 项目", "06 writing", "06 写作"]);
export const canMoveBoardCard = (path: string) => boardFolders.has(rootFolder(path));
