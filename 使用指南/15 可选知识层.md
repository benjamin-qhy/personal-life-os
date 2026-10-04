# 可选知识层：claude-obsidian

[claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) 是 Daniel Agrici 的 Claude Code 插件，提供知识组织与来源追踪，包括 `/save`、`/wiki-query`、`/wiki-ingest`、`/wiki-lint`、`/autoresearch`、`/think`、`/canvas`，以及 Bases 和 Markdown 参考。写入事务先制定计划、展示哈希，再等待批准。

它不是 Personal Life OS 的运行依赖，也不是 Pi ACP 的内置能力。事务核心只写入 `wiki/` 与 `.raw/`；日记、静修、任务、人物和写作仍通过 Obsidian 的 QuickAdd、Templater、Tasks、Kanban 或明确授权的其他工具操作。Claude Code 通过根目录 `CLAUDE.md` 跳转到库规则。

| 路径 | 用途 |
| --- | --- |
| `.claude-obsidian.json` | 工作区标记，包含 `role: vault`、`source_inbox: inbox` |
| `inbox/` | 待摄取来源 |
| `.raw/.manifest.json` | 增量摄取记录 |
| `wiki/overview.md`、`hot.md`、`index.md`、`log.md` | 概览、近期上下文、索引、操作日志 |
| `wiki/routing-map.md` | 本人维护的内容路由规则 |
| `wiki/meta/ledgers/*.json` | 来源与论断账本 |
| `.obsidian/snippets/vault-colors.css` | 文件树中的知识目录颜色 |
| `.vault-meta/` | 运行日志，忽略提交且不进入发行包 |
| `.gitignore` | 排除上述运行状态以及 `.mcp.json`、工作区状态、回收站 |

任务仪表盘排除 `wiki/` 中的清单，避免把资料里的勾选项算成生活任务。

## 原生依赖与命令

第三方插件核心仍由 Python 运行，Bun 工具迁移没有替换它。先安装并配置该插件，再把 `CORE` 设置为实际缓存路径：

```bash
CORE="<claude plugin cache>/claude-obsidian/<version>/scripts/claude-obsidian.py"
python3 "$CORE" doctor --vault .
python3 "$CORE" lint --vault . --format markdown
```

也可在 Claude Code 中使用 `/claude-obsidian:wiki-query`、`/claude-obsidian:save`、`/claude-obsidian:wiki-lint`。每次写入必须经过检查、批准、应用，即 inspect → approve → apply；不要使用 `--force` 绕过审批。

可选环境变量 `CLAUDE_OBSIDIAN_SESSION_CONTEXT=1` 会在会话开始时读取 `wiki/hot.md`。这意味着笔记内容进入模型上下文，需本人明确选择。

没有此插件时，`wiki/` 与 `inbox/` 仍是普通 Markdown 目录；只是不提供这些专用命令，其他生活工作流不受影响。
