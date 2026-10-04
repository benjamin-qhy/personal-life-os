# 看板

Kanban 2.0.51 的插件 ID 为 `obsidian-kanban`，上游仓库为 [community-archive/obsidian-kanban](https://github.com/community-archive/obsidian-kanban)，原仓库属于 mgmeyers。看板仍是 Markdown：每个二级标题是一栏，每条 `- [ ]` 是一张卡片；停用插件后仍可搜索、链接和阅读。

| 看板路径 | 流程 | 捕获入口 |
| --- | --- | --- |
| `04 Projects/Projects Board` | 想法、季度计划、进行中、等待、完成 | 项目想法 |
| `06 Writing/Newsletters/Newsletter Board` | 待办、大纲、草稿、编辑、待发布、已发布 | 通讯想法 |
| `06 Writing/YouTube Scripts/YouTube Board` | 同上 | 视频想法 |
| `06 Writing/Articles/Article Board` | 同上 | 文章想法 |
| `06 Writing/Course Content/Course Board` | 同上 | 手动添加 |

## 连接方式

- 插件配置支持 `@{2026-09-30}` 形式的日期，链接到每日笔记，并可显示相对日期和归档日期。
- 每张看板底部的 `%% kanban:settings %%` 保存新笔记目录与模板。把卡片转换成笔记时，例如通讯卡片，会在 `06 Writing/Newsletters` 使用 `Templates/Newsletter.md` 创建正文。
- `Meta/views/boards.js` 发现带 `kanban-plugin` 属性的笔记并汇总栏位数量，罗盘使用简版，[[Boards|看板总览]] 展示完整列表。
- 配置项 `board_done_lanes` 决定哪些栏位属于完成状态。旧英文栏名和中文栏名均应保留对应配置。

## 使用建议

每种工作一张看板，放在其目录中。先捕获，再逐步推进；只有实际发布后才移到已发布。卡片作为指针，具体工作放在它链接的笔记里。静修时可由本人确认归档已完成卡片。

## 维护说明

上游曾公开寻求维护者，因此升级前应在独立测试库验证。Markdown 格式使看板在插件不可用时仍可作为列表阅读；迁移到其他看板工具仍需检查功能和格式，不能假定完全兼容。
