import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { inspectNote, policyPath } from "./note-tools";
import { Type } from "@earendil-works/pi-ai";

export async function inspectDirectory(cwd: string, folder: string) {
      const parts = folder.split("/");
      if (isAbsolute(folder) || /[\\:\x00-\x1f]/.test(folder) || parts.some(part => !part || part.startsWith("."))) throw new Error("需提供非隐藏的库内目录。");
      let path = await realpath(cwd);
      for (const part of parts) {
        path = join(path, part); const info = await lstat(path);
        if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("目录无效或包含符号链接。");
      }
  return path;
}

export function discoveryTools(cwd: string) {
  return [defineTool({
    name: "list_notes", label: "列出指定目录", description: "只列出用户任务所需的明确目录中的 Markdown 文件名和子目录，不读取正文、不递归、不默认扫描整个库。每次最多200项。",
    parameters: Type.Object({ folder: Type.String({ description: "明确的库内目录，例如 04 Projects，不允许空值或库根" }), prefix: Type.Optional(Type.String({ description: "文件名前缀，可按年月缩小日记范围" })) }),
    async execute(_id, params, signal) {
      const path = await inspectDirectory(cwd, params.folder);
      signal?.throwIfAborted();
      const names = (await readdir(path, { withFileTypes: true })).filter(item => (!params.prefix || item.name.startsWith(params.prefix)) && !item.name.startsWith(".") && !item.isSymbolicLink() && (item.isDirectory() || (item.isFile() && item.name.toLowerCase().endsWith(".md"))))
        .sort((a, b) => a.name.localeCompare(b.name));
      const result = { entries: names.slice(0, 200).map(item => ({ path: `${params.folder}/${item.name}`, type: item.isDirectory() ? "folder" : "note" })), truncated: names.length > 200 };
      signal?.throwIfAborted();
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }], details: {} };
    },
  }), defineTool({
    name: "search_notes", label: "搜索指定笔记", description: "只在明确选中的最多32篇笔记内按字面文本查找，返回来源与行号，不默认全库搜索。先按任务需要列目录再选择笔记。",
    parameters: Type.Object({ paths: Type.Array(Type.String(), { minItems: 1, maxItems: 32 }), query: Type.String({ minLength: 2, maxLength: 200 }) }),
    async execute(_id, params, signal) {
      if (!params.query.trim() || params.query.length < 2 || params.paths.length < 1 || params.paths.length > 32) throw new Error("需要明确笔记列表和至少两个字符的查询。");
      const matches: { path: string; line: number; text: string }[] = [];
      let total = 0; let truncated = false;
      for (const path of [...new Set(params.paths)]) {
        signal?.throwIfAborted();
        if (policyPath(path) === "08 tasks/tasks.md") throw new Error("任务总表不能直接读取或搜索。");
        const note = await inspectNote(cwd, path);
        total += Buffer.byteLength(note.text);
        if (total > 2 * 1024 * 1024) throw new Error("选定笔记总量超过2 MiB，请缩小范围。");
        for (const [index, line] of note.text.split(/\r?\n/).entries()) {
          if (line.includes(params.query)) {
            if (matches.length === 100) { truncated = true; break; }
            matches.push({ path, line: index + 1, text: line.slice(0, 500) });
          }
        }
        if (truncated) break;
      }
      signal?.throwIfAborted();
      return { content: [{ type: "text" as const, text: JSON.stringify({ matches, truncated }) }], details: {} };
    },
  })];
}
