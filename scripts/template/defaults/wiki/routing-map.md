---
type: meta
title: 内容路由
status: evergreen
created: 2026-08-26
updated: 2026-08-26
tags:
  - meta
  - routing
---

# 内容路由

这里规定 claude-obsidian 操作在 Personal Life OS 中保存内容的位置。插件只能写入 `wiki/`，摄取原始材料使用 `.raw/`。所有写入都经过 inspect → approve → apply，即检查、批准、应用。优先链接原有笔记，不复制个人正文。

| 操作 | 目标 | 规则 |
| --- | --- | --- |
| `/save` 保存回答、决定或见解 | `wiki/concepts/<slug>.md` | 每个想法一页，链接相关笔记；不把日记正文复制到知识层。 |
| `/save` 保存获准的会话摘要 | `wiki/log.md` | 经批准追加，最新完成的操作排在最前。 |
| 摄取书籍、文章、字幕或网页 | `wiki/sources/<slug>.md` 与来源账本 | 本人手写的书籍笔记保留在 `07 书库/读书笔记`，包括模板属性与块引文，不移动。 |
| 与人物有关的内容 | 链接 `05 人物/<Name>.md` | 已有人物笔记时，不另建 `wiki/entities/<name>.md` 副本。 |
| 与项目有关的内容 | 链接 `04 项目/<Name>.md` | 已有项目笔记时不另建副本。 |
| 日记、静修、规划、习惯和任务 | 不摄取 | 属于个人生活数据，不建立账本行或来源模型。 |
| 留待研究的问题 | `wiki/index.md` 的“待研究问题”章节 | `autoresearch` 会访问网络，只在明确同意后运行。 |

模式保留 `generic`，不创建 `.vault-meta/mode.json`。不要切换到 PARA，以免在 `wiki/` 中重复现有的 `04 项目` 和 `03 规划`。
