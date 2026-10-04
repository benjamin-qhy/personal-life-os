在 Agent Client 中选择已配置的 **Personal Life OS Pi**，在笔记库内使用 AI。以下流程遵守 `AGENTS.md`；这是操作原则，不是技术保证，不能据此认定每个客户端和工具都强制审批。检查当前客户端已关闭自动批准。安装与配置见 [[14 Agent Client and Claude Code|Agent Client 与 AI 接入]]；没有插件时可读取 `Prompts/`，手动复制其中的 Prompt 章节，详见 [[20 Prompt Library|提示词库]]。

## 发送前

按钮只准备提示词，全部禁用自动发送。请先在输入框检查，再主动发送。下方嵌入聊天使用当前 Assistant 页面作为上下文（`noteContext: hosting`），不保证包含你刚才查看的其他笔记。

- 核对所选代理、提及的笔记、附件和双链展开设置。需要某篇笔记时主动附加，或在工具可用时明确授权读取。
- 使用模型服务商的会话会把提示词、已附加和之后检索的内容发送给该服务商。日记与人物关系笔记可能含敏感个人信息。
- 大范围回顾前，先让助手列出拟读取的路径和日期范围，确认上下文后再继续。
- 批准读取上下文，不代表批准编辑、安装、付费或发布。每次写入都要看到目标和完整具体变更，明确批准后才执行。
- 已配置代理或本地 API 密钥，不代表已通过身份认证、连接可用或流程已验收。
- Pi 可使用实际提供的工具；`read_note` 不等于 Obsidian MCP 已连接。活动笔记、导航、搜索和命令等能力须核实实际工具。缺少能力时说明并停止相关操作，改由你提供上下文或使用 Obsidian 原生创建、评分按钮，不能编造成功。
- 凭据和会话保存在笔记库之外；不要把密钥粘贴进笔记。知识层只能通过已安装插件的 inspect、approve、apply 事务写入。

第一方 Personal Life OS 仪表盘本身不请求模型服务商。这里的控件将任务交给 Agent Client，实际行为由客户端设置、所选代理及工具决定。

## 每日
```agent
type: button
text: "开始今天"
prompt: "读取 Prompts/01 Morning Start.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "引导今晚的每日问题"
prompt: "读取 Prompts/02 End of Day Coaching.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "今天什么最重要"
prompt: "读取 Prompts/14 What Matters Today.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```

## 每周与季度
```agent
type: button
text: "复盘本周"
prompt: "读取 Prompts/03 Weekly Review.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "准备个人静修"
prompt: "读取 Prompts/04 Retreat Prep.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "引导这次静修"
prompt: "读取 Prompts/05 Retreat Facilitation.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "分析问题与习惯趋势"
prompt: "读取 Prompts/13 Trend Analysis.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```

## 工作
```agent
type: button
text: "整理任务收件箱"
prompt: "读取 Prompts/06 Task Triage.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "准备这次会面"
prompt: "读取 Prompts/07 Meeting Prep.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "启动这个项目"
prompt: "读取 Prompts/08 Project Kickoff.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "整理看板"
prompt: "读取 Prompts/09 Board Grooming.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```

## 写作与研究
```agent
type: button
text: "协助创作这篇内容"
prompt: "读取 Prompts/10 Writing Pipeline.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "发布前 SEO 检查"
prompt: "读取 Prompts/11 SEO Pre-publish Audit.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "将资料归入知识库"
prompt: "读取 Prompts/12 Research Capture.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```

## 系统
```agent
type: button
text: "检查笔记库健康状况"
prompt: "读取 Prompts/15 Vault Health Check.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```
```agent
type: button
text: "帮助我设置笔记库"
prompt: "读取 Prompts/16 Onboarding Assistant.md，先确认实际可用的 read_note 或 Obsidian MCP vault_read，再遵循其中的 Prompt 章节。请先核对我明确提供的目标笔记与日期范围，不要假设嵌入聊天包含其他活动笔记。"
viewType: embed
autoSend: false
```

## 对话
```agent-client
type: chat
agent: personal-life-os-pi
height: 600px
id: lifeos-assistant
persist: true
noteContext: hosting
```
