# 插件与首次打开

发行候选包含十个社区插件和第一方 Personal Life OS 插件。它们沿用各自许可证，完整版本与来源见 `THIRD_PARTY_NOTICES.md`。Obsidian 本身不包含在发行包中。

## 工作流插件

| 插件 | ID | 用途 |
| --- | --- | --- |
| QuickAdd | `quickadd` | 捕获日记、收获、感恩、任务和想法，创建周期及业务笔记 |
| Periodic Notes | `periodic-notes` | 日、周、季度笔记导航，分目录和模板配置 |
| Tasks | `obsidian-tasks-plugin` | 行内任务、项目人物查询、仪表盘和阅读任务 |
| Dataview | `dataview` | 习惯、每日问题、人生之轮、项目等属性视图 |
| Kanban | `obsidian-kanban` | 每种写作类型及项目的独立看板 |
| Templater | `templater-obsidian` | 日期计算、每日问题提示、文件夹模板与新笔记生成 |
| Omnisearch | `omnisearch` | 库内搜索，HTTP 服务默认关闭 |
| Local REST API | `obsidian-local-rest-api` | 本机浏览器/API 连接；MCP 需另行验证宿主支持 |
| Agent Client | `agent-client` | ACP 聊天与嵌入按钮，桌面专用 |
| SEO | `seo` | 发布前检查，默认不检查私人日记与外链 |
| Personal Life OS | `life-os-app` | 原生首页、模块导航、捕获和本地属性概览 |

核心插件 Web viewer 用于应用内阅读。视频中的 Bases 用于“往年今日”；本模板使用 DataviewJS 实现该展示，底部保留可选 Bases 写法。具体应用要求以发行说明中的最低 Obsidian 版本为准，不能据此推断任意旧版本都可运行。

上游：[QuickAdd](https://github.com/chhoumann/quickadd)、[Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes)、[Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks)、[Dataview](https://github.com/blacksmithgu/obsidian-dataview)、[Kanban](https://github.com/mgmeyers/obsidian-kanban)、[Templater](https://github.com/SilentVoid13/Templater)。扩展说明见 [[14 Agent Client and Claude Code|助手]]、[[16 SEO, Web Viewer, and Vault Lens|研究与发布]]、[[17 Search Providers|搜索服务]]。

## 首次打开独立候选

源码仓库中的模板含构建标记，不能直接复制到正在使用的库。先通过 `bun run build:template` 生成独立候选，再在 Obsidian 中打开该候选目录。

1. Obsidian 首次询问受限模式时，由本人决定是否加载第三方插件。此选择不是库文件中的可移植设置。
2. 若插件未加载，可运行 Obsidian 的不保存重载命令。首页在布局就绪后打开，也可使用罗盘图标或首页命令进入。
3. 在外观设置中确认 `lifeos` CSS 片段启用，对应 `reading`、`intention`、`memento`、`theme` 提示块。
4. 确认 Templater 开启新文件触发和文件夹模板。新笔记通过 QuickAdd 的规范入口创建并运行模板。
5. Periodic Notes 的日格式为 `YYYY-MM-DD`、周为 `gggg-[W]ww`、季度为 `YYYY-[Q]Q`，分别指向 `01 Journal/Daily`、`Weekly`、`Quarterly`。核心 Daily Notes 默认关闭，避免重复入口。
6. 完整候选中的 QuickAdd 应有 20 个入口：8 个捕获、4 个周期笔记、8 个项目人物及内容模板。关闭阅读的变体会移除阅读专属入口。每个需要快捷键的入口应注册为命令。
7. 确认 Dataview 的 JavaScript 查询开启。打开罗盘仪表盘，没有真实数据时应看到明确空状态。

如果笔记仍显示 `<%` 模板代码，先确认打开的是构建后的候选，再检查 Templater 是否正常运行，不要把代码当成个人内容填写。

## 快捷键

| 按键 | 动作 |
| --- | --- |
| Ctrl/Cmd+Shift+L | 打开应用首页 |
| Ctrl/Cmd+Shift+C | 打开统一捕获 |
| Ctrl/Cmd+Shift+D | 创建或打开今日笔记 |
| Ctrl/Cmd+Alt+W | 创建或打开本周笔记 |
| Ctrl/Cmd+Alt+Q | 创建或打开本季度笔记 |
| Ctrl/Cmd+Shift+J | 追加带时间的日记 |
| Ctrl/Cmd+Shift+W | 记录收获 |
| Ctrl/Cmd+Shift+G | 记录感恩 |
| Ctrl/Cmd+Shift+T | 添加任务 |
| Ctrl/Cmd+Shift+Q | 在今日笔记运行每日问题提示 |

快捷键可在设置中修改，重载后确认没有冲突。第三方插件更新前先在测试库验证，不直接用现用个人库试验。

## 捕获路由

| 捕获 | 目标 | 格式与章节 |
| --- | --- | --- |
| 日记 | `01 Journal/Daily/{{DATE:YYYY-MM-DD}}.md` | `- {{DATE:HH:mm}} {{VALUE}}`，日记章节 |
| 收获、感恩 | 同上 | `- {{VALUE}}`，各自章节 |
| 任务 | `08 Tasks/Tasks.md` | `- [ ] {{VALUE}} ➕ {{DATE:YYYY-MM-DD}}`，收件箱 |
| 通讯、视频、文章想法 | 各自写作看板 | `- [ ] {{VALUE}}`，待办栏 |
| 项目想法 | `04 Projects/Projects Board.md` | `- [ ] {{VALUE}}`，想法栏 |
| 日、周、季度、静修 | 对应规范目录 | 日期文件名与对应模板，已存在则打开 |
| 项目、人物 | `04 Projects/`、`05 People/` | 输入名称，从 Project 或 Person 模板创建 |
| 通讯、视频、文章、课程 | 对应 `06 Writing/` 子目录 | 输入标题，从对应模板创建 |
| 书籍、研读笔记 | `07 Library/Book Notes/`、`09 Reading/Study Notes/` | 输入标题，从对应模板创建 |

同名笔记不能被模板覆盖。新中文章节与旧英文 `Journal`、`Wins`、`Gratitude`、`Inbox`、`Backlog`、`Ideas` 需要兼容；内部命令 ID 保持稳定，不随中文显示名称更改。

## 可选 Bases 写法

如需自行改用 Bases，可创建 `Meta/On This Day.base` 并在每日模板嵌入 `![[On This Day.base]]`：

```yaml
filters:
  and:
    - file.inFolder("01 Journal/Daily")
    - file.name != this.file.name
    - file.name.endsWith(this.file.name.slice(4))
views:
  - type: table
    name: 往年今日
    order:
      - file.name
    sort:
      - property: file.name
        direction: DESC
```

这是可选修改，需根据所用版本检查 [Bases 函数文档](https://help.obsidian.md/bases/functions)，不能把示例当成已做原生验收。
