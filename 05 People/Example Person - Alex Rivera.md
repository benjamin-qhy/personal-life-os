---
type: person
role: 示例
company: 
email: 
meets: weekly
tags:
  - person
  - example
---
标签：`#p/example-person-alex-rivera`

## 待讨论
```tasks
not done
tags include #discuss
tags include #p/example-person-alex-rivera
sort by created
```

## 相关未完成任务
```tasks
not done
tags include #p/example-person-alex-rivera
tags do not include #discuss
sort by due
```

## 共同项目
```dataview
LIST
FROM "04 Projects"
WHERE contains(people, this.file.link) AND status != "done"
```

## 笔记
- 这是示例人物笔记。“待讨论”汇总所有带 `#discuss #p/example-person-alex-rivera` 的任务，见面前可打开查看。

## 会面记录
- 2026-08-26 已创建。
