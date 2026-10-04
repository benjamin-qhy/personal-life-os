import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Compass Boards widget: every Kanban board in the vault with card counts per lane.
// Usage:
//   await dv.view("系统/views/boards")                       all boards, all lanes
//   await dv.view("系统/views/boards", { compact: true })    one line per board: open cards + the lane that needs attention
//   await dv.view("系统/views/boards", { folder: "06 写作" })
const cfg: Partial<Page> = dv.page("系统/系统配置") || {};
const FOLDER = input && input.folder ? input.folder : null;
const COMPACT = !!(input && input.compact);
const DONE_LANES = (cfg.board_done_lanes || "Done,Published,Archive,已完成,已发布,归档").split(",").map(s => s.trim().toLowerCase());

const boards = dv.pages(FOLDER ? `"${FOLDER}"` : "").where(p => {
  const fm = p.file.frontmatter || {};
  return typeof fm["kanban-plugin"] === "string";
}).sort(p => p.file.path).array();

const root = dv.container.createEl("div", { cls: "lifeos-widget" });
if (boards.length === 0) {
  root.createEl("p", { text: "暂无看板。看板笔记的属性中包含 kanban-plugin。" });
} else {
  const parsed = [];
  for (const b of boards) {
    const tfile = app.vault.getFileByPath(b.file.path);
    if (!tfile) continue;
    let text = "";
    try { text = await app.vault.cachedRead(tfile); } catch (e) { continue; }
    text = text.replace(/^---[\s\S]*?---\n/, "");
    const cut = text.indexOf("\n%% kanban:settings");
    if (cut !== -1) text = text.slice(0, cut);
    const archiveCut = text.indexOf("\n***");
    if (archiveCut !== -1) text = text.slice(0, archiveCut);
    const lanes: Array<{name: string; cards: Array<{done: boolean; text: string}>}> = [];
    let cur: (typeof lanes)[number] | null = null;
    for (const line of text.split("\n")) {
      const h = line.match(/^##\s+(.*)$/);
      if (h) { cur = { name: h[1]!.trim(), cards: [] }; lanes.push(cur); continue; }
      const c = line.match(/^- \[( |x)\]\s+(.*)$/);
      if (c && cur) cur.cards.push({ done: c[1] === "x", text: c[2]!.trim() });
    }
    const open = lanes.filter(l => !DONE_LANES.includes(l.name.toLowerCase())).reduce((s, l) => s + l.cards.length, 0);
    const done = lanes.filter(l => DONE_LANES.includes(l.name.toLowerCase())).reduce((s, l) => s + l.cards.length, 0);
    parsed.push({ page: b, lanes, open, done });
  }

  if (COMPACT) {
    const table = root.createEl("table", { cls: "lifeos-table" });
    const tr = table.createEl("thead").createEl("tr");
    for (const h of ["看板", "未完成", "已完成", "栏目"]) tr.createEl("th", { text: h });
    const tb = table.createEl("tbody");
    for (const b of parsed) {
      const r = tb.createEl("tr");
      const td = r.createEl("td");
      const a = td.createEl("a", { text: b.page.file.name, cls: "internal-link", attr: { href: b.page.file.path, "data-href": b.page.file.path } });
      a.addEventListener("click", e => { e.preventDefault(); app.workspace.openLinkText(b.page.file.path, "", false); });
      r.createEl("td", { text: String(b.open) });
      r.createEl("td", { text: String(b.done) });
      r.createEl("td", { text: b.lanes.filter(l => !DONE_LANES.includes(l.name.toLowerCase())).map(l => `${l.name} ${l.cards.length}`).join("  ·  ") });
    }
  } else {
    for (const b of parsed) {
      const h = root.createEl("h4");
      const a = h.createEl("a", { text: b.page.file.name, cls: "internal-link", attr: { href: b.page.file.path, "data-href": b.page.file.path } });
      a.addEventListener("click", e => { e.preventDefault(); app.workspace.openLinkText(b.page.file.path, "", false); });
      h.appendText(`  （${b.open} 未完成，${b.done} 已完成）`);
      const table = root.createEl("table", { cls: "lifeos-table" });
      const tr = table.createEl("thead").createEl("tr");
      for (const l of b.lanes) tr.createEl("th", { text: `${l.name} (${l.cards.length})` });
      const row = table.createEl("tbody").createEl("tr");
      for (const l of b.lanes) {
        const td = row.createEl("td");
        td.style.verticalAlign = "top";
        const items = l.cards.slice(0, 6);
        for (const c of items) {
          const d = td.createEl("div", { text: c.text.replace(/@\{[^}]*\}/g, "").replace(/\[\[|\]\]/g, "").trim() });
          if (c.done) d.style.opacity = "0.5";
          d.style.fontSize = "0.85em";
        }
        if (l.cards.length > items.length) td.createEl("div", { text: `另有 ${l.cards.length - items.length} 项` }).style.opacity = "0.6";
      }
    }
  }
}
