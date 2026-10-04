# 从这里开始

Personal Life OS 是对 Mike Schmitz 在视频《How I Run My Whole Life Out of Obsidian》中介绍的工作流的独立实现。视频由 Practical PKM 于 2026-06-26 发布：[观看原视频](https://www.youtube.com/watch?v=-h7ZAuuNDLE)。中文版开发者为秋水 / qiushui，来源说明见 `CREDITS.md`。

第一次使用请先打开 [[Setup|设置向导]]，查看状态清单和第一天、第一周、第一个月的安排。本页提供全库导航。

| 工作流 | 主要位置 | 说明 |
| --- | --- | --- |
| 日记与每日问题 | `01 Journal/Daily`、每日笔记及问题模板、`Meta/Compass Config.md` | [[03 Workflow - Journaling and Daily Questions|日记与每日问题]] |
| 季度个人静修 | `02 Retreats`、`Templates/Personal Retreat.md` | [[04 Workflow - Personal Retreat|个人静修]] |
| 多尺度规划 | `01 Journal` 的日、周、季度笔记与 `03 Planning` | [[05 Workflow - Multi-Scale Planning|多尺度规划]] |
| 习惯追踪 | 每日笔记的 `habit_*` 属性、习惯画布 | [[06 Workflow - Habit Tracking|习惯追踪]] |
| 每日阅读（圣经为示例） | `09 Reading` | [[07 Workflow - Daily Reading|每日阅读]] |
| 任务、项目与人物 | `08 Tasks/Tasks.md`、`04 Projects`、`05 People`、任务仪表盘 | [[08 Workflow - Task Management|任务管理]] |
| 写作与书库 | `06 Writing` 下的各类看板、`07 Library` | [[09 Workflow - Writing|写作]] |
| 罗盘仪表盘 | `00 Dashboards/Compass Dashboard.md`、`Meta/views/*.js` | [[10 Compass Dashboard|仪表盘]] |
| 看板 | 项目与写作看板、`00 Dashboards/Boards.md` | [[13 Kanban Boards|看板]] |
| AI 助手 | `AGENTS.md`、`Prompts/`、`00 Dashboards/Assistant.md` | [[14 Agent Client and Claude Code|Agent Client 与 Pi]]、[[20 Prompt Library|提示词库]] |
| 可选知识层 | `wiki/`、`inbox/`、`wiki/routing-map.md` | [[15 claude-obsidian|claude-obsidian]] |
| 研究与发布 | Web viewer、SEO、Vault Lens | [[16 SEO, Web Viewer, and Vault Lens|研究与发布]]、[[17 Search Providers|搜索服务]] |
| 可选 MCP 桥接 | 受信宿主连接、`.mcp.example.json` | [[19 Obsidian MCP Bridge|MCP 桥接]] |
| 应用首页 | 原生导航、捕获、今日状态与 AI 入口 | [[21 Life OS Application|Personal Life OS 应用]] |

接下来可读 [[01 Principles|设计原则]]、[[02 Plugins|插件与首次打开]]、[[11 Build Order|逐层建立习惯]]、[[12 Resources and Links|来源与资源]]。

## 一次只加一层

视频作者用了五年逐步建立这套系统。先选一个工作流，通常是每日日记，坚持约 30 天，再增加下一层。设置向导按这个顺序提供建议，不需要第一天填满所有页面。

## 维护者

使用 Bun 运行 `scripts/build_template.ts`，在独立输出目录生成候选版本，再用 `scripts/verify_template.ts` 验证。不要直接覆盖当前 `.obsidian`。发布检查见 `scripts/RELEASE.md`。
