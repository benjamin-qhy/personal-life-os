习惯记录来自日记中的 `habit_*` 勾选属性。不增加提醒，也不因连续记录中断而评判自己。本页面只展示已有记录，旁边的日记能够解释当天的背景。

## 最近 8 周
```dataviewjs
{{lifeos-dashboard:habit-canvas-1}}
```

## 最近 2 周
```dataviewjs
{{lifeos-dashboard:habit-canvas-2}}
```

## 调整要记录的习惯

1. 打开 [[Compass Config|系统配置]]。
2. 调整 `habits` 列表，保留 `habit_` 前缀，不重命名或删除已有笔记中的属性键。
3. 新日记会使用新的勾选属性，仪表盘自动发现它们。

每个阶段记录少量习惯，通常 3 至 5 项即可。诚实记录比追求完美记录更有用。

## 询问助手
```agent
type: button
text: "分析问题与习惯趋势"
prompt: "读取 Prompts/13 Trend Analysis.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: right-pane
autoSend: false
```
