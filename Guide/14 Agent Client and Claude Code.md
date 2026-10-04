# Agent Client 与 Pi 助手

Agent Client 0.12.1（`agent-client`）通过 Agent Client Protocol（ACP）启动本地智能体，在侧栏、标签页、浮窗或笔记内显示聊天。它是仅限桌面的第三方插件，采用 Apache-2.0 许可证：[上游仓库](https://github.com/RAIT-09/obsidian-agent-client)。文件名保留兼容旧链接，中文版默认接入方向是 Pi 1.0.0 与 Bun ACP 适配层。

## 助手能做什么

可以中文流式聊天，并主动提供要分享的文本、未保存 Markdown 选区、库内 Markdown 文件附件和提示词。附件经过路径、符号链接及大小检查，单次消息总量上限为 1 MiB。不要假定智能体已经读过整库或 `AGENTS.md`：Pi 适配层目前不会自动读取库、项目提示词、技能和扩展，客户端的当前笔记、链接笔记和嵌入聊天上下文取决于客户端设置。发送前检查实际提供的内容。

[[Assistant|助手]]、[[Compass Dashboard|罗盘]] 与模板按钮提供周回顾、静修准备、今日重点和写作等入口，任务正文集中在 [[20 Prompt Library|提示词库]]。按钮只准备提示词，不自动发送。能否执行所需工具取决于当前智能体适配层，不能把按钮存在等同于工具已接通。

保持自动批准关闭。`AGENTS.md` 是本库行为规则，但不能替代工具层权限。Pi 适配层提供受限读取、检索和笔记修改，每次写入展示准确目标和完整差异，只接受单次批准；其他客户端及 MCP 工具必须分别检查权限。

## 本机设置

非 AI 的日记、任务、规划和阅读不需要 Bun。使用开发中的 Pi ACP 接入时，维护者先安装项目依赖：

```sh
bun install --frozen-lockfile
bun run acp
```

`acp` 是供客户端启动的标准输入输出 JSON-RPC 进程，不是终端聊天界面。发行候选已包含 `scripts/ai-runtime/pi-acp.js`，默认智能体 ID 为 `personal-life-os-pi`，命令为 `bun`，参数为 `["run", "./scripts/ai-runtime/pi-acp.js"]`，工作目录为当前库根目录。若图形环境找不到 Bun，只在本机设置中填写其绝对路径。源码开发的 `bun run acp` 与发行运行文件使用同一协议；路径与密钥不要写进发行模板。运行配置见下表，MCP 配置见 [MCP 桥接指南](19%20Obsidian%20MCP%20Bridge.md)。维护者可在源码仓库查阅 `docs/agents/pi-acp-development.md` 的开发记录；发行用户无需该文件。

| 配置 | 含义 |
| --- | --- |
| `LIFE_OS_PROVIDER` | Pi 内置或自定义供应商标识 |
| `LIFE_OS_MODEL` | 默认模型 ID |
| `LIFE_OS_MODELS` | 自定义服务可选模型 ID，以逗号分隔 |
| `LIFE_OS_BASE_URL` | 可选 OpenAI 兼容服务地址，远程地址使用 HTTPS |
| `LIFE_OS_API_KEY_ENV` | 密钥环境变量的名字，默认指向 `LIFE_OS_API_KEY` |
| `LIFE_OS_SESSION_DIR` | 库外私有会话目录，默认 `~/.local/share/personal-life-os/sessions`，按笔记库隔离 |
| `LIFE_OS_API_KEY` | 默认密钥变量；若指定 `LIFE_OS_API_KEY_ENV`，改用它所命名的变量 |
| `LIFE_OS_AUTH` | 默认 `api-key`；明确设为 `codex` 才读取本机 Codex 登录 |
| `LIFE_OS_MCP_CONFIG` | 可选，显式指定库外 MCP 配置文件；不从库内自动发现连接 |

Pi 会话文件包含对话和工具结果，保存在库外，不随模板分发。候选中的 Agent Client 另带库外缓存兼容补丁，客户端聊天正文、标题、目录及嵌入会话索引也保存在库外。密钥通过启动环境提供，真实密钥不写入文档。候选默认支持 `LIFE_OS_AUTH=codex`、`LIFE_OS_PROVIDER=openai-codex` 与 `LIFE_OS_MODEL=gpt-6.1-sol`，只读本人已有 Codex 登录；令牌过期需在 Codex 重新登录，不复制刷新令牌。其他服务商通过本机环境变量提供密钥。首次验证先使用合成消息和测试库；最终 Agent Client 原生操作由用户按 [[23 Native Acceptance|人工验收清单]] 测试。

## 聊天记录存在哪里

客户端聊天缓存放在电脑用户目录的 `.local/share/personal-life-os/agent-client/<笔记库路径摘要>/`。不同笔记库分开存放，标题和会话列表在该目录的 `index.json` 中，正文存为独立文件。Pi 自己的会话仍使用上方 `LIFE_OS_SESSION_DIR`。笔记库内的 Agent Client 设置不保存 `savedSessions`，也不建立 `sessions` 缓存目录。

聊天和历史记录入口保持原样。复制、移动笔记库或换电脑不会自动迁移聊天；客户端删除历史记录只删除该客户端缓存，Pi 的独立会话保留策略不变。主动“导出聊天”仍是你明确选择的操作，会把选中的内容写到所选导出位置，默认自动导出保持关闭。

缓存目录不可写、索引损坏或路径不安全时会停止保存并报错，不改回库内存储。发现非空旧版库内索引时，不自动读取、搬运或删除旧聊天，需要另行安排迁移。当前项目没有旧数据，不需要迁移步骤。移动端不启用此桌面 AI 插件，原有非 AI 功能照常使用。

macOS / Linux 使用私有目录和文件权限；Windows 使用系统自带 PowerShell 检查用户访问权限，系统组件被禁用或检查失败时会明确停止，不降低权限要求。Windows 原生表现仍需在实际设备上手测。若电脑异常退出后提示存在遗留锁，应先确认所有使用该笔记库的 Obsidian 进程已关闭，再检查报错；不要在另一个窗口仍保存聊天时移除锁。

**不要直接用 Obsidian 的上游 Agent Client 更新覆盖兼容版本。** 上游原版会恢复库内缓存行为。请使用 Personal Life OS 重新核验后生成的新候选。插件目录保留 `upstream-main.js`、原许可证及 `LIFE_OS_CACHE_PATCH.json` / `LIFE_OS_CACHE_PATCH_NOTICE.txt`，便于核对来源；不要把备用原文件重命名为入口文件。

## 供应商、模型与凭据

Agent Client 启动智能体时，智能体配置中的 `env` 会覆盖 Obsidian 进程继承的同名环境变量。候选智能体已在 `env` 中设置 `LIFE_OS_AUTH`、`LIFE_OS_PROVIDER`、`LIFE_OS_MODEL`，因此仅修改本机同名环境变量不会切换供应商。请在 Agent Client 的自定义智能体设置中修改这三个非秘密字段，或删除它们后从启动环境提供；也可另建智能体，分别保留不同供应商配置。

密钥只通过启动 Obsidian 的本机环境提供，确认图形应用也继承了该环境；不要把真实密钥放进 Agent Client 的库内 `env` 设置。修改本机环境后，完全退出 Obsidian，再从带有新环境的启动方式重新打开，使 Obsidian 和智能体进程都获得新值。修改智能体设置后也应停止旧智能体进程、重新启动并新建会话，避免继续使用旧进程配置。下列“设置”均需遵循上述覆盖顺序。

- **Codex 订阅**：候选默认使用 `LIFE_OS_AUTH=codex`、`LIFE_OS_PROVIDER=openai-codex`、`LIFE_OS_MODEL=gpt-6.1-sol`。本机先登录 Codex；认证文件取自 `CODEX_HOME/auth.json`，未设置时为 `~/.codex/auth.json`。只读访问令牌、到期时间和账户标识，不复制刷新令牌或自动刷新。令牌过期或剩余有效期不足五分钟时，在 Codex 重新登录后创建新会话。此模式只允许官方模型地址，不设置 `LIFE_OS_BASE_URL`。
- **Pi 内置供应商**：设置 `LIFE_OS_AUTH=api-key`、该供应商的 `LIFE_OS_PROVIDER` 和模型目录中的 `LIFE_OS_MODEL`，把密钥放入 `LIFE_OS_API_KEY`；不设置 `LIFE_OS_BASE_URL`。若已有专用密钥环境变量，可把其变量名填入 `LIFE_OS_API_KEY_ENV`。内置供应商使用 Pi 模型目录，账号仍须具有调用权限。
- **自定义 OpenAI 兼容服务**：设置 `LIFE_OS_AUTH=api-key`、自定供应商标识、服务实际提供的 `LIFE_OS_MODEL` 和 `LIFE_OS_BASE_URL`，以同样方式提供密钥。可用 `LIFE_OS_MODELS` 添加逗号分隔的模型 ID，默认模型始终包含在列表中。地址使用 HTTPS，本机回环服务可用 HTTP；地址不能携带用户名、密码、查询参数或片段。当前按文本输入、32768 上下文和 4096 输出上限注册模型。

客户端的“模型”菜单只切换当前供应商内的模型；恢复会话保留选择，回复期间不能切换。更换供应商或服务地址时，另设智能体并新建会话。同一笔记库的适配层进程必须使用相同的 `LIFE_OS_SESSION_DIR`，才能共享笔记写入锁；该目录包含对话和工具结果，应保持库外私有。最终原生界面操作仍按 [人工验收清单](23%20Native%20Acceptance.md) 测试。

## 当前限制

适配层关闭 Pi 的默认文件与命令工具。第一方工具可按明确范围读取、列举和搜索笔记，在既有 H2/H3 下追加，更新已有属性，在项目、人物、写作和书籍的既有章节内准确替换，以及在项目/写作看板中移动单张卡片。不能创建或删除笔记，不重写日记、静修和规划正文，不写知识层与系统目录。任务总表不能直接读取或搜索，只允许按批准内容捕获到收件箱。

显式 MCP 配置仅开放只读与导航白名单，不透传远端写入或任意命令。需要本人配置受信宿主服务，Local REST API 的安装不保证该服务存在。连接方式见 [[19 Obsidian MCP Bridge|MCP 桥接]]。

Pi 会话可在库外保存与恢复；客户端“模型”菜单支持在同一供应商内切换模型，恢复会话保留选择，回复进行中禁止切换。切换供应商或地址需另设智能体并新建会话，目录里有模型也不保证账号具有调用权限。取消和拒绝追加不能产生该次写入。锁仅协调本适配层进程，外部编辑器不遵守它，因此仍应避免审批期间并行修改目标笔记。本指南描述当前能力，原生界面通过与否以最终人工验收结果为准。

## 其他智能体与兼容环境

Agent Client 也支持 Claude Code、Codex、Gemini CLI 等其他适配器，它们的依赖、凭据及权限与 Pi 链路独立。原 Claude Code 路线需要 Claude Code 本机登录以及 `@agentclientprotocol/claude-agent-acp`；不要把第三方适配器的 Node.js 要求通过更换命令名假装迁移到 Bun。安装与路径自动检测请按对应上游说明执行。

如明确选择原 Claude Code 路线，可按其上游方式安装并首次登录，再安装原 ACP 适配器：

```sh
curl -fsSL https://claude.ai/install.sh | bash
claude
npm install -g @agentclientprotocol/claude-agent-acp
which claude-agent-acp
```

这些是可选第三方安装步骤，不是构建 Personal Life OS 所需命令。Agent Client 的 Claude Code 预设可自动检测或填写返回路径；运行测试聊天确认连接。若采用 API Key 或系统钥匙串，按该插件对应版本说明配置，不把凭据写入库。

Linux Flatpak 的沙箱可能看不到宿主 `/usr/local/bin`，其 `PATH` 与宿主不同。若使用原 Node 适配器，可在用户目录中准备包装脚本，明确指向沙箱可见的 Node 和适配器入口：

```sh
#!/bin/sh
exec "$HOME/.local/bin/node" "/path/to/lib/node_modules/@agentclientprotocol/claude-agent-acp/dist/index.js" "$@"
```

可用 `npm root -g` 查到全局模块目录，拼接 `/@agentclientprotocol/claude-agent-acp/dist/index.js`。替换真实路径，以 `chmod +x` 赋予包装脚本执行权限，再在客户端填写完整路径。原上游也记录过 `flatpak override --user --filesystem=host-os:ro md.obsidian.Obsidian`，再使用 `/var/run/host/usr/...` 路径的方案，但那会扩大沙箱范围，不是默认要求。Pi/Bun 的 Flatpak 启动路径需要单独验证，不能用 Node 包装脚本的成功代替。

## 笔记中的聊天与按钮

使用语言为 `agent-client` 或 `agent` 的 YAML 代码块。[嵌入块文档](https://rait-09.github.io/obsidian-agent-client/usage/embeddable-blocks.html)

- 聊天块：`type: chat`，可设置 `agent`、`model`、`height`；`id` 与 `persist: true` 用于恢复，`noteContext: hosting` 指向承载笔记。
- 按钮：`type: button`、`text`、`prompt`，`viewType` 可选 `right-pane`、`floating`、`editor-tab`、`embedded`。保持 `autoSend: false`。
- 自动导出保持关闭。手动导出到 `Meta/Agent Chats` 的聊天可能包含被提及的笔记，并会进入库搜索。
- Obsidian 格式提示可保留，用于 wikilink、公式和表格；它不授予读取其他笔记的权限。

发送给模型的消息、笔记和附件会离开本机。模板不携带密钥、机器路径、会话或聊天导出；构建只改独立候选，不覆盖当前 `.obsidian`。
