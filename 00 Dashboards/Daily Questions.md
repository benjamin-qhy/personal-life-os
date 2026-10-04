“我是否尽力……”以 1 至 10 分记录努力程度，思路来自 Marshall Goldsmith 的《Triggers》。它关注努力而非结果：生病时努力慢跑 3 英里可以是 10 分；原计划 12 英里，仅因不想跑而减到 6 英里，可以是 5 分。评分由你自己决定。

问题对应日记里的 `dq_*` 数值属性。编辑 [[Compass Config|系统配置]] 的 `questions` 列表，新日记与晚间问题引导会使用新配置；已有记录的属性键保持不变。

## 趋势
```dataviewjs
{{lifeos-dashboard:daily-questions-1}}
```

## 已回答的日期
```dataviewjs
{{lifeos-dashboard:daily-questions-2}}
```

## 询问助手
```agent
type: button
text: "分析问题与习惯趋势"
prompt: "读取 Prompts/13 Trend Analysis.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: right-pane
autoSend: false
```
