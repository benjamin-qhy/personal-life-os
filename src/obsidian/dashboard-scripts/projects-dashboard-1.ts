import type { Dataview, Page } from "../views/host";
declare const dv: Dataview;
const cfg: Partial<Page> = dv.page("系统/系统配置") || {};
const folder = cfg.projects_folder || "04 项目";
const projects = dv.pages(`"${folder}"`).where(p => p.type === "project" && p.status !== "done").sort(p => p.due ?? "9999", "asc").array();
const slug = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "");
const allTasks = dv.pages().where(p => !p.file.path.startsWith("wiki/")).array().flatMap(p => Array.from(p.file.tasks || []));
const rows = projects.map(p => {
  const tag = "#project/" + slug(p.file.name);
  const mine = allTasks.filter(t => (t.tags || []).some(x => x === tag || x.startsWith(tag + "/")));
  const open = mine.filter(t => !t.completed).length;
  const done = mine.filter(t => t.completed).length;
  const pct = open + done ? Math.round(100 * done / (open + done)) : 0;
  const statusLabels: Readonly<Record<string, string>> = { active: "进行中", done: "已完成", paused: "已暂停", planned: "计划中", archived: "已归档" };
  return [p.file.link, statusLabels[p.status || ""] || p.status || "未设置", p.area ?? "", p.quarter ?? "", p.due ?? "", open, `${pct}%`];
});
dv.table(["项目", "状态", "领域", "季度", "到期", "待办任务", "进度"], rows);
