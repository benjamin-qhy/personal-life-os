<p align="center"><img src="Meta/attachments/cover.png" alt="Personal Life OS" width="100%"></p>

# Personal Life OS

用 Obsidian 连接日记、规划、习惯、任务、人物、阅读与写作。中文版开发者：**秋水 / qiushui**。

本项目基于 Compass 工作流，独立实现 Mike Schmitz 在《How I Run My Whole Life Out of Obsidian》中介绍的方法。Markdown、链接和属性始终是数据本体，应用首页提供导航、捕获和汇总，AI 辅助需要明确上下文与写入批准。没有第二套生活数据库，也不要求常驻后端。

**当前是开发中的候选版本，不能视为已完成原生验收的公开发行。** 旧 1.0.2 归档早于应用首页实现；下一候选模板版本为 1.1.0。最低目标 Obsidian 版本为 1.13.1。桌面和移动端的原生操作由用户在最终候选上手测，Agent Client 与本地 API 桥接仅限桌面。

## 演示与来源

[![观看 Daniel Agrici 的 Compass 演示](https://i.ytimg.com/vi/0mUx4z6M5AU/hqdefault.jpg)](https://www.youtube.com/watch?v=0mUx4z6M5AU)

[观看演示](https://www.youtube.com/watch?v=0mUx4z6M5AU)，展示的是 Compass 来源工作流，不是本轮中文候选的验收证据。

[![观看原始工作流视频](https://img.youtube.com/vi/-h7ZAuuNDLE/maxresdefault.jpg)](https://www.youtube.com/watch?v=-h7ZAuuNDLE)

[Mike Schmitz 原视频](https://www.youtube.com/watch?v=-h7ZAuuNDLE) 由 Practical PKM 于 2026-06-26 发布。本项目与 Practical PKM、LifeHQ、Obsidian Starter Vault 没有隶属或背书关系，不包含其付费库文件或文字。来源见 [CREDITS.md](CREDITS.md)。

## 开始使用

1. 普通用户使用经过检查的构建候选或正式发行包，解压到独立目录。**仓库是开发源码，`Templates/` 可能含构建标记，不要直接复制到现用笔记库。**
2. 在 Obsidian 中选择“打开文件夹作为仓库”，打开解压目录。
3. 首次打开时由本人决定是否关闭受限模式并启用所附插件。若未加载，可运行不保存重载命令。
4. 打开 `00 Dashboards/Setup.md`，按设置向导检查本机状态。
5. 从一项工作流开始：Ctrl/Cmd+Shift+D 打开今日笔记，晚间 Ctrl/Cmd+Shift+Q 回答每日问题，留下简短日记。熟悉后再增加其他模块。

带 `example` 标签的笔记是演示数据，不是你的真实记录。确认自己已有记录后，可逐篇检查并删除不需要的示例。非 AI 日常功能不需要 Bun；Bun 用于开发构建和可选的 Pi ACP 运行。

## 目录

| 路径 | 内容 |
| --- | --- |
| `00 Dashboards/` | 设置、罗盘、习惯、问题、任务、项目、看板和助手 |
| `01 Journal/` | 日、周、季度笔记 |
| `02 Retreats/` | 季度个人静修与人生之轮属性 |
| `03 Planning/` | 人生主题、核心价值观与角色、理想一周 |
| `04 Projects/` | 项目笔记、`#project/<slug>` 任务与项目看板 |
| `05 People/` | 人物笔记、`#p/<slug>` 与 `#discuss` 汇总 |
| `06 Writing/` | 通讯、视频脚本、文章、课程，各有独立看板 |
| `07 Library/` | 书籍笔记与带块标识的引文 |
| `08 Tasks/` | 任务总表，捕获到此，从仪表盘查看 |
| `09 Reading/` | 可选阅读计划、章节、经节、研读与主题索引 |
| `Prompts/` | 16 个重复工作流提示词 |
| `Templates/` | 模板源码；构建后由 Templater 使用 |
| `Meta/` | `Compass Config.md`、生成视图、资源与版本说明 |
| `Guide/` | 原则、工作流、插件、AI 和人工验收说明 |
| `wiki/`、`inbox/` | 可选 claude-obsidian 知识层 |
| `src/`、`scripts/`、`tests/` | TypeScript 实现、Bun 工具与合成测试 |

`Meta/Compass Config.md` 集中维护问题、习惯、人生领域、目录、前缀、生日等配置。`dq_*`、`habit_*`、`wheel_*` 是稳定机器键，仪表盘按前缀发现记录。显示文案中文化不改变内部路径、命令 ID 和历史属性。

## 七个工作流

| 工作流 | 指南 |
| --- | --- |
| 日记与每日问题 | [日记](Guide/03%20Workflow%20-%20Journaling%20and%20Daily%20Questions.md) |
| 季度个人静修 | [静修](Guide/04%20Workflow%20-%20Personal%20Retreat.md) |
| 多尺度规划 | [规划](Guide/05%20Workflow%20-%20Multi-Scale%20Planning.md) |
| 习惯追踪 | [习惯](Guide/06%20Workflow%20-%20Habit%20Tracking.md) |
| 可选每日阅读 | [阅读](Guide/07%20Workflow%20-%20Daily%20Reading.md) |
| 任务、项目与人物 | [任务](Guide/08%20Workflow%20-%20Task%20Management.md) |
| 写作与书库 | [写作](Guide/09%20Workflow%20-%20Writing.md) |

先读 [从这里开始](Guide/00%20Start%20Here.md)，一次只增加一层。罗盘、看板、Brain 和助手读取这些已有工作流，不替代它们。

## 随包插件

| 插件 | ID | 版本 | 许可证 |
| --- | --- | --- | --- |
| Dataview | `dataview` | 0.5.68 | MIT |
| Templater | `templater-obsidian` | 2.25.0 | AGPL-3.0 |
| Periodic Notes | `periodic-notes` | 0.0.17 | MIT |
| QuickAdd | `quickadd` | 2.23.0 | MIT |
| Tasks | `obsidian-tasks-plugin` | 8.4.0 | MIT |
| Kanban | `obsidian-kanban` | 2.0.51 | GPL-3.0 |
| Omnisearch | `omnisearch` | 1.30.1 | GPL-3.0 |
| Local REST API | `obsidian-local-rest-api` | 5.1.0 | MIT |
| Agent Client | `agent-client` | 0.12.1 | Apache-2.0 |
| SEO | `seo` | 0.5.6 | MIT |

第一方 `life-os-app` 单独版本化，采用 MIT。上游版本、来源和许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)，字节级来源检查属于独立发行检查。首次打开与快捷键见 [插件指南](Guide/02%20Plugins.md)。

## AI 与隐私

- `AGENTS.md` 规定目录、属性、读取范围和每次写入审批；`CLAUDE.md` 与 `GEMINI.md` 指向它。规则文件不是所有外部工具的强制权限沙箱。
- 保留 Agent Client 界面，默认技术方向为 **Pi 1.0.0 + Bun ACP**。适配层按客户端需要启动，不新增常驻服务。配置与当前限制见 [Pi 助手配置指南](Guide/14%20Agent%20Client%20and%20Claude%20Code.md)。
- 当前 Pi 适配层只接收显式提供的文本上下文，支持 Markdown 选区与文件附件、受限读取检索、章节追加与允许范围的局部修改、已有属性更新、逐卡移列、拒绝、取消、Pi 库外会话恢复和同供应商模型菜单切换。显式 MCP 只开放只读/导航白名单；新建、删除、任意插件命令和知识层事务需要原生操作或对应工具，原生界面仍待用户手测。
- 密钥通过本机启动环境提供，Pi 会话留在库外。上游 Agent Client 仍有无法仅靠关闭导出禁用的库内消息缓存，完整客户端库外存储方案尚待确认和验收，不能宣称全部会话已满足库外要求。发送给模型的消息、笔记和工具结果会到达所选服务商。
- Local REST API 的安装并不保证提供 `/mcp` 或提示词所需工具。MCP 需要另行配置并验证受信的宿主连接，其能力与 Pi 自带工具分别验收。不要把真实 `.mcp.json`、会话、聊天导出、证书或设置截图放进发行包。
- claude-obsidian 是独立可选第三方知识层，其核心仍需要 Python；第一方 Bun 迁移没有替换这个运行依赖。

更多说明：[助手](Guide/14%20Agent%20Client%20and%20Claude%20Code.md)、[提示词库](Guide/20%20Prompt%20Library.md)、[MCP](Guide/19%20Obsidian%20MCP%20Bridge.md)。

## 开发、构建与验证

![自动验证](https://github.com/benjamin-qhy/personal-life-os/actions/workflows/verify.yml/badge.svg)

使用 Bun 1.3.14。维护代码采用 TypeScript，Obsidian 产物仍为宿主可运行的 JavaScript。

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build:obsidian
bun run build:template --out ../life-os-releases --name Personal-Life-OS-candidate --version 1.1.0 --zip
bun scripts/verify_template.ts ../life-os-releases/Personal-Life-OS-candidate
```

构建到全新独立目录，不修改当前 `.obsidian`。构建器排除 Git 状态、个人记录、凭据、机器路径、运行缓存与会话，只保留规定的示例数据，重置候选默认设置，生成宿主脚本、版本和工作区，然后验证并打包。`--without-reading` 生成不含阅读模块的变体。

验证检查命名与路径、链接、属性和配置、插件许可证与版本、安全过滤、脚本可加载性及包大小。恢复验证检查归档路径、符号链接、哈希和内容完整性。流程见 [发布清单](scripts/RELEASE.md)。自动化和浏览器合成结果不等同于原生 Obsidian 通过，最终由用户完成 [人工验收清单](Guide/23%20Native%20Acceptance.md)。

目前没有原地事务升级器。先备份完整库，在旁边解压新版本，逐项对照迁入个人内容和自定义配置；不要整包覆盖当前 `.obsidian`。备份要实际恢复检查后才可信。

## 来源与许可证

工作流来源为 Mike Schmitz 的公开视频；每日问题来自 Marshall Goldsmith 与 Mark Reiter 的《Triggers》（2015）；多尺度规划来自 Cal Newport。完整致谢见 [CREDITS.md](CREDITS.md)。

代码、模板、仪表盘、脚本和配置采用 [MIT](LICENSE)，`Guide/` 的说明文字采用 [CC BY 4.0](LICENSE-GUIDE.md)。第三方插件保留各自许可证。参与方式见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题见 [SECURITY.md](SECURITY.md)，社区规则见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)，变更记录见 [CHANGELOG.md](CHANGELOG.md)。
