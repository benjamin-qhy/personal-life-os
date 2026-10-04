---
quarter: {{lifeos-script:quarterly-note-1}}
retreat: "[[02 Retreats/{{lifeos-script:quarterly-note-2}} Personal Retreat]]"
focus_area: 
tags:
  - quarterly
---
« [[01 Journal/Quarterly/{{lifeos-script:quarterly-note-3}}|上季度]] · [[Compass Dashboard]] · [[01 Journal/Quarterly/{{lifeos-script:quarterly-note-4}}|下季度]] »

{{lifeos-script:quarterly-note-5}} 至 {{lifeos-script:quarterly-note-6}} · 静修：[[02 Retreats/{{lifeos-script:quarterly-note-7}} Personal Retreat]]

> [!theme]- 人生主题与核心价值观
> ![[Life Theme#人生主题]]
> ![[Core Values#价值观]]

```agent
type: button
text: "准备个人静修"
prompt: "读取 Prompts/04 Retreat Prep.md，并按其 Prompt 章节处理当前打开的笔记；若无适用笔记，则使用当前周期。"
viewType: right-pane
```

## 季度意图
在个人静修中确定，复制或嵌入这里，便于周笔记引用。
![[{{lifeos-script:quarterly-note-8}} Personal Retreat#5. 下一季度意图]]

## 重点领域（来自人生之轮）
- 

## 本季度项目
```dataview
TABLE WITHOUT ID file.link AS "项目", status AS "状态", area AS "领域", due AS "到期日期"
FROM "04 Projects"
WHERE quarter = "{{lifeos-script:quarterly-note-9}}" AND status != "done"
SORT due ASC
```

## 每周记录
```dataview
LIST
FROM "01 Journal/Weekly"
WHERE quarter = "{{lifeos-script:quarterly-note-10}}"
SORT file.name ASC
```

## 本季度每日问题
```dataviewjs
{{lifeos-script:quarterly-note-13}}
```

## 季末记录
将这些记录带到下次静修的回顾中。
- 
