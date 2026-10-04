# 可选 Obsidian MCP 桥接

本库提示词约定使用支持 Obsidian 的 MCP 服务，以打开笔记、切换看板、发现并执行命令、搜索和编辑。历史配置示例把服务地址写为 `http://127.0.0.1:27123/mcp`，但当前仅发现已安装 Local REST API，尚未确认存在提供下列 MCP 工具的宿主服务。REST API 插件已启用不等于 MCP 已可用；必须先配置并验证受信宿主连接。

Pi ACP 支持显式 stdio 和 Streamable HTTP MCP，只注册明确只读与导航工具。笔记写入仍使用第一方安全工具，不透传未知远端写入、删除或任意命令。不能因插件已安装就声称宿主连接已可用。

## 工具与用途

下表是 Obsidian MCP 生态中提示词可能提及的工具，并非 Pi 全部开放。Pi 白名单为 `active_file_get_path`、`vault_read`、`vault_list`、`vault_get_document_map`、`search_simple`、`tag_list`、`open_file`、`command_list`。有范围要求的工具需提供明确且可识别的路径参数，不满足 schema 要求时不注册。

| 工具 | 用途 |
| --- | --- |
| `open_file` | 在应用中打开笔记、看板或仪表盘 |
| `command_list`、`command_execute` | 先发现命令，再执行 QuickAdd、Templater、SEO、看板或应用命令 |
| `active_file_get_path` | 确认“这篇笔记”具体指哪一篇 |
| `vault_list`、`vault_read`、`vault_get_document_map` | 查看目录、读取笔记或指定章节 |
| `vault_append`、`vault_patch` | 经批准后追加或局部修改 |
| `vault_write`、`vault_move`、`vault_copy`、`vault_delete` | 整篇写入、移动、复制、删除；本库对这些操作有更严格约束 |
| `search_simple`、`search_query`、`tag_list` | 文本搜索、元数据查询与标签列表 |

看板也是 Markdown，移动卡片应对具体卡片做局部 patch，不重写整张看板。创建当天笔记的既有命令为 `quickadd:choice:lifeos-daily`，日记捕获为 `quickadd:choice:lifeos-journal`，执行前仍需确认命令存在。

## Pi 的显式连接

ACP 会话提供的非空 `mcpServers` 优先。Agent Client 传空列表时，只有设置 `LIFE_OS_MCP_CONFIG` 才读取该库外 JSON 文件，最多 64 KiB、四个服务，不搜索默认位置、不把凭据保存到会话。HTTP 使用 HTTPS 或本机 HTTP，不支持旧 SSE；stdio 命令用绝对路径，且只继承显式列出的环境变量。

连接凭据用 `valueEnv` 引用本机环境变量，不把真实值写进 Agent Client 的库内配置。完整格式如下。无效配置、缺少变量或连接失败都会报错，不静默回退。

先在库外创建普通 JSON 文件，并通过 Obsidian 启动环境将 `LIFE_OS_MCP_CONFIG` 设置为该文件的绝对路径。服务名称使用 1 到 24 个英文字母、数字、连字符或下划线，不得重复。以下是 Streamable HTTP 格式示例：

```json
{
  "mcpServers": [{
    "type": "http",
    "name": "obsidian",
    "url": "http://127.0.0.1:3001/mcp",
    "headers": [{"name": "Authorization", "valueEnv": "OBSIDIAN_MCP_AUTH"}]
  }]
}
```

示例不会创建或启动 HTTP 服务。把地址换成本人已配置且受信的 MCP 服务；URL 不得带用户名、密码、查询参数或片段。启动环境中的 `OBSIDIAN_MCP_AUTH` 应提供完整请求头值，包括服务要求的 `Bearer ` 前缀。无需鉴权的本机服务可省略 `headers`。

stdio 连接的完整格式如下；替换可执行文件的绝对路径和服务实际需要的参数：

```json
{
  "mcpServers": [{
    "type": "stdio",
    "name": "obsidian",
    "command": "/absolute/path/to/obsidian-mcp-server",
    "args": [],
    "env": [{"name": "SERVER_TOKEN", "valueEnv": "OBSIDIAN_MCP_TOKEN"}]
  }]
}
```

`valueEnv` 表示从启动环境读取值，传入子进程时命名为 `name`，不接受直接写凭据的 `value`。stdio 不继承其他环境变量，包括模型密钥；若服务需要 `PATH`、`HOME` 或其他变量，也须逐项显式配置。没有所需环境变量时会报错。替换配置后创建新会话，检查服务实际提供的工具；这里只提供连接格式，不代表服务已验证可用。模型与会话配置见 [Pi 助手指南](14%20AI%20助手与%20Agent%20Client.md)。

MCP 搜索必须有明确目录和查询，不接受任务总表目录；结果限制为 64 KiB，并响应取消。工具名称和声明不能约束恶意服务内部行为，因此只能连接本人信任的宿主。工具在模型侧显示为 `mcp_<服务名>_<工具名>`。

## 外部客户端设置

密钥保存在用户配置或启动环境中，不在库内创建含密钥的 `.mcp.json`。`.mcp.example.json` 只是无凭据示例。

只有确认该地址确实提供 MCP 后，Claude Code 才可在用户作用域注册。以下保留历史示例，不是当前连接已验证的声明：

```bash
claude mcp add --scope user --transport http obsidian http://127.0.0.1:27123/mcp \
  --header "Authorization: Bearer <本机 Local REST API 设置中的密钥>"
claude mcp list
```

重启对应智能体会话后，在测试库尝试打开项目看板，观察工具调用和权限提示。Codex 使用用户级 MCP 配置，Gemini CLI 使用其 `mcpServers` 配置；字段随客户端版本变化，按各自当前官方文档配置 URL 与鉴权，不把示例密钥写入仓库。

原 `.claude/settings.json` 只为读取、搜索、命令列表及打开文件提供允许列表；实际权限还受客户端其他设置影响。命令执行与写入不能因为读取已授权而自动放行。

## 多个客户端

聊天侧栏和终端智能体是独立进程，可以连接同一个 Obsidian。它们不需要额外实时通信才能访问同一库，但也不能假定对方已经完成任务。若需要在笔记中交接，先让本人批准具体记录，不自行复制日记或敏感对话。

## 安全约束

保持回环绑定和自动批准关闭。API Key 授予库访问权，REST API 本身不强制本库的“先询问再写入”规则。外部客户端也可能绕开 Agent Client 的审批界面。

`vault_delete` 通常进入回收站，但仍只在明确要求时使用；`vault_write` 会替换整篇文件，对现有笔记优先用 `vault_patch` 或 `vault_append`。遵循 `AGENTS.md` 的目录、隐私和审批规定。
