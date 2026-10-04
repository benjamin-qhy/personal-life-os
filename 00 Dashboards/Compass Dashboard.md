---
cssclasses:
  - lifeos-dashboard
---
以下内容来自已有笔记。每日模板、静修笔记或配置变化后，页面会自动更新，日常使用不需要修改代码。

```dataviewjs
{{lifeos-dashboard:compass-dashboard-1}}
```

> [!theme] 人生主题
> ![[Life Theme#人生主题]]

## 人生之轮（本季度静修）
```dataviewjs
{{lifeos-dashboard:compass-dashboard-2}}
```

## 每日问题
展示日记中各个 `dq_*` 属性的曲线与均值，可切换问题和时间范围。
```dataviewjs
{{lifeos-dashboard:compass-dashboard-3}}
```

## 习惯
```dataviewjs
{{lifeos-dashboard:compass-dashboard-4}}
```

## 看板
```dataviewjs
{{lifeos-dashboard:compass-dashboard-5}}
```

## 珍惜有限的时间
```dataviewjs
{{lifeos-dashboard:compass-dashboard-6}}
```

## 询问助手
打开 [[Assistant|AI 助手]] 查看完整提示词库，或使用下方入口。需要 Agent Client 和已配置的代理；先检查上下文及实际工具能力，按钮不会自动发送。

```agent
type: button
text: "今天什么最重要"
prompt: "读取 Prompts/14 What Matters Today.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: right-pane
autoSend: false
```
```agent
type: button
text: "复盘本周"
prompt: "读取 Prompts/03 Weekly Review.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: right-pane
autoSend: false
```

## 相关仪表盘

- [[Habit Canvas|习惯画布]]
- [[Daily Questions|每日问题]]
- [[Task Dashboard|任务仪表盘]]
- [[Projects Dashboard|项目仪表盘]]
- [[Boards|看板]]
- [[Assistant|AI 助手]]
- [[Setup|初始设置]]
- [[Ideal Week|理想一周]] · [[Core Values|核心价值观]] · [[Life Theme|人生主题]]
