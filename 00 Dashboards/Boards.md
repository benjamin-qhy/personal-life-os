笔记库中的 Kanban 看板直接从源文件读取。卡片从左向右推进，已完成或已发布列用于完成统计。看板本身就是 Markdown，QuickAdd 的想法捕获会追加到对应待办列；中文列名与旧英文列名按配置兼容。

```agent
type: button
text: "整理看板"
prompt: "读取 Prompts/09 Board Grooming.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: right-pane
autoSend: false
```

## 概览
```dataviewjs
{{lifeos-dashboard:boards-1}}
```

## 项目
```dataviewjs
{{lifeos-dashboard:boards-2}}
```

## 写作
```dataviewjs
{{lifeos-dashboard:boards-3}}
```

## 添加看板

1. 在合适目录创建笔记，打开命令面板运行 Kanban 的新建看板命令，或在属性中添加 `kanban-plugin: board`。
2. 命名各列，把完成状态列放在最后，使用“已完成”“已发布”等名称，并确保 `board_done_lanes` 包含对应值。原有 `Done`、`Published` 继续兼容，配置见 [[Compass Config|系统配置]]。
3. 可选：在看板设置中指定新建笔记目录和笔记模板，确保从卡片创建笔记时应用正确模板。
