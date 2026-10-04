# 工单跟踪：GitHub

工程工单与规格文档存放在 benjamin-qhy/personal-life-os 的 GitHub Issues 中。
使用 gh CLI 时明确传入 --repo benjamin-qhy/personal-life-os，避免误操作上游仓库。

这里跟踪笔记库系统的工程工作。个人任务继续使用现有 Obsidian 工作流。
不要把日记原文复制到 GitHub。网络操作或发布之前，遵循 AGENTS.md 的隐私与授权规则。

## 使用约定

- 创建： gh issue create --repo benjamin-qhy/personal-life-os --title "<title>" --body-file <file>
- 读取： gh issue view <number> --repo benjamin-qhy/personal-life-os --comments
- 列出： gh issue list --repo benjamin-qhy/personal-life-os --state open --json number,title,body,labels
- 评论： gh issue comment <number> --repo benjamin-qhy/personal-life-os --body-file <file>
- 添加标签： gh issue edit <number> --repo benjamin-qhy/personal-life-os --add-label "<label>"
- 移除标签： gh issue edit <number> --repo benjamin-qhy/personal-life-os --remove-label "<label>"
- 关闭： gh issue close <number> --repo benjamin-qhy/personal-life-os

多行内容使用正文文件，文件中必须是已经批准的准确文本。
创建该文件也须遵循笔记库的文件审批规则。操作前先澄清有歧义的工单或 PR 编号。

## 拉取请求是否作为分诊入口

不使用 PR 作为需求提交入口。

## 技能术语

“发布到工单跟踪系统”指在获得所需授权后创建 GitHub issue。

“获取相关工单”指读取指定的 GitHub issue 及其评论。

## Wayfinding 操作

- 地图：用一个带 wayfinder:map 标签的工单作为地图，包含 Notes、Decisions-so-far 和 Fog。
- 子工单：如果支持 GitHub sub-issues，就用它将子工单关联到地图；否则在地图中使用任务列表，并在每个子工单中添加 Part of #<map>。
- 类型：wayfinder:research、wayfinder:prototype、wayfinder:grilling 和 wayfinder:task。
- 阻塞关系：优先使用原生工单依赖；不可用时，在每个子工单中记录 Blocked by: #<number>。
- 下一项：按地图顺序选择第一个尚未关闭、未分配且没有未解决阻塞项的子工单。
- 认领：在授权范围内，开始工作前将工单分配给负责的开发者。
- 完成：发布已批准的结果，关闭工单，并在地图的 Decisions-so-far 中追加简短的结果链接。
