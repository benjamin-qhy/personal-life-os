---
type: project
status: active
area: 
quarter: {{lifeos-script:project-1}}
started: {{lifeos-script:project-2}}
due: 
people: []
tags:
  - project
---
在笔记库的任意位置为任务添加 `#project/{{lifeos-script:project-3}}`，即可在这里汇总。点击任务就能回到说明任务缘由的原始笔记。

```agent
type: button
text: "启动这个项目"
prompt: "使用当前可用的 read_note 或已配置 Obsidian MCP 的 vault_read 读取 Prompts/08 Project Kickoff.md，按照其中的 Prompt 章节处理我当前打开的笔记；若不适用，则使用当前周期。"
viewType: right-pane
```

## 预期成果
怎样才算完成：
- 

## 下一步行动
```tasks
not done
tags include #project/{{lifeos-script:project-4}}
sort by due
```

## 本页任务
- [ ] 第一步 #project/{{lifeos-script:project-5}}

## 笔记


## 进展记录
- {{lifeos-script:project-6}} 已创建。

## 已完成
```tasks
done
tags include #project/{{lifeos-script:project-7}}
sort by done reverse
limit 20
```
