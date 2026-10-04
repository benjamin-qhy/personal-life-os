---
status: open
setup_claude_login: false
setup_mcp_registered: false
setup_vault_lens: false
setup_backup: false
tags:
  - setup
---
每晚用一组诚实的问题回顾自己，再逐层加入规划、习惯、任务、写作和 AI 助手。Personal Life OS 中文版由秋水维护；系统思路参考 Mike Schmitz 的“How I Run My Whole Life Out of Obsidian”，与 Practical PKM 无隶属关系。

## 第一步：启用插件

首次打开此目录时，Obsidian 会提示受限模式。选择关闭；若已关闭提示，可在“设置 → 社区插件”关闭受限模式。模板预装了所需社区插件及第一方 Personal Life OS 插件。随后按 Ctrl/Cmd+P，运行不保存直接重载应用的命令，重载后 Personal Life OS 会自动打开。

**如果下方显示的是代码而非检查清单，请先完成插件启用。**

## 设置状态
```dataviewjs
{{lifeos-dashboard:setup-1}}
```

四项需要你自己确认：模型服务登录、MCP 注册、浏览器扩展和备份，完成后在本笔记属性中勾选。为保持兼容，模型登录的历史属性键仍为 `setup_claude_login`；勾选只代表你的确认，不证明认证或连接已实际验证。Pi 是默认 AI 接入，Obsidian MCP 需按需配置，不会因勾选而自动启动。

## 今天（约 20 分钟）

1. 完成上面的插件启用。
2. 打开 [[Compass Config|系统配置]]，按意愿填写 `birthdate`，也可自行填写而不发送给 AI。
3. 在 [[Life Theme|人生主题]] 的“## 人生主题”下写一句草稿，首次静修再完善。旧笔记使用“## Theme”时可继续保留。
4. 打开 [[Compass Dashboard|人生罗盘]] 查看示例展示；带 `example` 的笔记是示例，不是你的真实记录。
5. 今晚用 Ctrl/Cmd+Shift+D 创建或打开今日日记，Ctrl/Cmd+Shift+Q 回答每日问题。自己给出 1 至 10 分，在“## 日记”（旧 Journal）写一行即可。

## 本周

- 早上 Ctrl/Cmd+Shift+D，晚上 Ctrl/Cmd+Shift+Q。
- 第 3 天：在 [[Compass Config|系统配置]] 调整一个不适合自己的问题，习惯保持 3 至 5 项。
- 第 7 天：查看 [[Daily Questions|每日问题]]，先观察，不急着改变。粗略填写 [[Ideal Week|理想一周]]；确认不再是示例后可手动移除其 `example` 标记。按需选择阅读模块；已包含时可打开 [[Reading Plan|阅读计划]]，不使用时可选择不含阅读模块的发行版本。

## 本月

- 第 8 天：真实记录已有积累时，用 `tag:#example` 查看残留示例。[[16 Onboarding Assistant|设置助手]] 可列出清单；日记、静修和规划记录由你手动处理，其他示例也必须逐文件确认后才移入垃圾箱。
- 第 14 天：用 Ctrl/Cmd+Alt+W 打开本周周记，只填写“做得好的地方”（旧 What went well）。
- 第 21 天：可选启用库内 AI，先读 [[14 Agent Client and Claude Code|Agent Client 与 AI 接入]]，再使用下方按钮。
- 第 30 天：若 30 天中有 25 天已评分，可阅读 [[04 Workflow - Personal Retreat|个人静修流程]]，安排第 60 至 90 天之间的一次静修。任务、写作看板和浏览器扩展可在之后逐层加入，见 [[11 Build Order|构建顺序]]。

## 与助手一起设置
```agent
type: button
text: "帮助我设置笔记库"
prompt: "读取 Prompts/16 Onboarding Assistant.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: right-pane
autoSend: false
```

## 中文与已有笔记

界面和新模板使用中文，目录、文件名、命令 ID 和属性键保持兼容。问题文案在 [[Compass Config|系统配置]] 中调整。不要重命名或删除旧笔记中的 `dq_*`、`habit_*`、`wheel_*`；自动化会识别对应的新中文和旧英文章节。

## 完成后

把本笔记的 `status` 设为 `done`，初始设置横幅便会隐藏。需要重新查看时设回 `open`。
