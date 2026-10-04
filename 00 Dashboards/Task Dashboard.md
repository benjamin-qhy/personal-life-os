本页用于**选择任务**。查看建议，选定真正要做的事，再安排到纸笔或日历中。系统帮助记住事项，具体行动由你决定。

```agent
type: button
text: "整理任务收件箱"
prompt: "读取 Prompts/06 Task Triage.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: right-pane
autoSend: false
```
```agent
type: button
text: "今天什么最重要"
prompt: "读取 Prompts/14 What Matters Today.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: right-pane
autoSend: false
```

使用 QuickAdd 的“添加任务”捕获到 [[Tasks|任务总表]]，日常通过查询查看，而非手工翻阅总表。用 `#project/<slug>` 或 `#p/<人物标签>` 关联项目或人物，中文标签保留中文，英文标签继续可用。下方查询按日期和上下文呈现任务。

## 已逾期
```tasks
not done
path does not include wiki/
due before today
sort by due
group by filename
```

## 今天
```tasks
not done
path does not include wiki/
(due on today) OR (scheduled on today)
path does not include 09 Reading/Reading Plan
sort by priority
group by filename
```

## 未来 7 天
```tasks
not done
path does not include wiki/
due after today
due before in 8 days
sort by due
group by due
```

## 待讨论（按人物）
```tasks
not done
path does not include wiki/
tags include #discuss
group by tags
sort by created
```

## 无日期的高优先级任务
```tasks
not done
path does not include wiki/
no due date
(priority is high) OR (priority is highest)
group by filename
```

## 收件箱（无归属、无日期）
```tasks
not done
path does not include wiki/
path includes 08 Tasks/Tasks
no due date
tags do not include #project
tags do not include #p/
limit 25
```

## 本周已完成
```tasks
done after 7 days ago
path does not include wiki/
group by done
```
