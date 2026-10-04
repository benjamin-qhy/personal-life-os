# Pi ACP 适配层开发说明

本目录对应已批准的 [Pi 接入决策](https://github.com/benjamin-qhy/personal-life-os/issues/5) 和 [阶段验收](https://github.com/benjamin-qhy/personal-life-os/issues/6)。当前已提供中文聊天、主动上下文、受限笔记工具和模型菜单的 ACP 链路；Obsidian 原生界面验收仍需在独立测试库完成。

## 已实现与验证

- ACP v1 标准输入输出握手、独立会话创建、中文流式输出。
- 自定义 OpenAI 兼容服务与 Pi 内置供应商模型选择。
- API Key 来自明确命名的环境变量；显式开启 Codex 模式时只读本机 Codex 登录，将现有访问令牌用于内存 OAuth 认证。
- 会话内并发请求拒绝、取消生成以及取消后继续聊天。
- 明确指定笔记读取与现有二级标题下追加；每次展示完整准确差异，只接受单次批准。拒绝、取消、未知选项和连接异常均不放行。
- 库外会话持久化与进程重启后的历史恢复；同一会话独占，失去占用锁后禁止继续请求。
- 笔记审批到提交期间持有跨进程锁，写入前检查内容变化及取消状态；受保护目录按大小写无关方式检查。
- 使用真实 ACP SDK 与 Pi SDK 连接本机模拟模型接口的自动化测试。

## 当前限制

- 接收 Agent Client 明确发送的文本、Markdown 选区 `resource` 和库内 Markdown 附件 `resource_link`，不自动扫描 vault、项目提示词、技能或扩展。选区使用客户端提供的内容，附件经过库内路径、符号链接和大小检查；单次消息总量上限 1 MiB。
- Pi 默认读写及命令工具全部关闭。提供受限读取、目录列表、指定笔记搜索、H2/H3 追加、现有属性更新、项目/人物/写作/书籍章节局部替换及看板移卡。所有写入均展示完整差异、单次审批并检查冲突；不创建或删除笔记，不改写日志/静修/规划正文，不写知识层和系统目录。任务总表禁止直接读取与搜索，仅允许收件箱捕获。
- MCP 支持显式 stdio 和 Streamable HTTP 配置，只注册明确只读/导航工具白名单。未知工具、远端写入、删除和任意命令不注册；不依赖服务声明来放开权限。
- 同一笔记库的所有适配层进程必须使用相同的会话存储目录，才能共享锁。锁仅协调本适配层写入；外部编辑器不遵守该锁，提交前的内容检查无法提供跨应用的绝对原子比较写入。
- Agent Client 通过 `configOptions` 的“模型”菜单和 `session/set_config_option` 切换同一供应商模型，重启恢复保留已选模型。切换供应商或地址应配置另一 Agent 并新建会话，已有会话恢复要求原供应商；回复期间禁止切换。供应商目录模型不代表当前账号一定有调用权限，调用失败会显示中文错误。
- 自定义模型暂以文本输入、32768 上下文、4096 输出上限注册；完整模型参数配置待接入。
- Codex 订阅真实聊天、批准追加、拒绝追加、进程重启恢复、流式取消及取消后继续已验收；其他供应商、Obsidian Agent Client 界面和移动端仍未验收。

## 运行

使用 Bun 1.3.14。安装依赖后执行：

```sh
bun run acp
```

这是标准输入输出协议进程，供 ACP 客户端启动，不是普通终端聊天程序。标准输出仅用于 JSON-RPC。

通过客户端启动环境提供以下变量，不将真实密钥写入文档或仓库：

| 变量 | 用途 |
| --- | --- |
| `LIFE_OS_PROVIDER` | Pi 内置供应商标识，或自定义供应商标识 |
| `LIFE_OS_MODEL` | 默认模型 ID |
| `LIFE_OS_MODELS` | 自定义 OpenAI 兼容服务的可选模型 ID，逗号分隔；默认模型始终包含在列表中。内置供应商使用 Pi 模型目录 |
| `LIFE_OS_AUTH` | 默认 `api-key`；设为 `codex` 时复用本机 Codex 的 ChatGPT 订阅登录 |
| `LIFE_OS_BASE_URL` | 可选，自定义 OpenAI 兼容服务地址；远程服务使用 HTTPS，本机模拟服务可以使用 HTTP |
| `LIFE_OS_API_KEY_ENV` | 可选，密钥所在环境变量的名字；默认 `LIFE_OS_API_KEY` |
| `LIFE_OS_SESSION_DIR` | 可选，库外私有会话目录；默认 `~/.local/share/personal-life-os/sessions`，按笔记库隔离，包含发送给模型的对话和工具结果 |
| `LIFE_OS_API_KEY` | 默认密钥变量；配置其他变量名时改用该变量 |

本阶段不更改当前 `.obsidian`，也不读取其凭据或个人配置。

## Codex 订阅验收

用户明确授权后，可使用已有 Codex 登录，不需要发送或复制密钥到项目。运行时设置：

```sh
LIFE_OS_AUTH=codex LIFE_OS_PROVIDER=openai-codex LIFE_OS_MODEL=gpt-6.1-sol bun run acp
```

Codex 模式仅允许 `openai-codex` 和模型目录中的官方 `https://chatgpt.com/backend-api` 地址，不接受自定义服务地址。认证文件位于 `CODEX_HOME/auth.json`，未设置时使用本机用户目录的 `.codex/auth.json`。只提取访问令牌、到期时间与账户标识，不复制刷新令牌；凭据存储拒绝修改、删除和自动刷新。令牌过期或剩余有效期不足五分钟时，需要在 Codex 中重新登录后创建新会话。

显式真实验收命令：

```sh
bun run scripts/verify_codex_acp.ts --live
```

该命令会使用订阅额度，只发送合成中文消息，在空测试目录下运行，默认拒绝所有工具审批，并仅输出通过状态、模型名、结束原因和分片数。临时测试目录结束后删除。它不属于默认自动化测试。

2026-10-04 实测：ACP → Pi 1.0.0 → `gpt-6.1-sol` 返回预期的“订阅验收通过”，共 6 个文本分片，结束原因 `end_turn`。加入只读凭据保护后复测仍通过。

2026-10-04 新增真实工具验收：`bun run scripts/verify_codex_tools.ts --live` 的批准追加、重启恢复、拒绝追加、流式取消、取消后继续五项均通过。脚本仅在临时库内使用合成笔记，自动批准仅限精确匹配的测试差异，结束后删除测试库和测试会话。MCP 与 Obsidian 界面仍需后续验收。

## 开发检查

```sh
bun test tests/acp
bun run typecheck
git diff --check
```

测试只使用合成对话和本机模拟接口，不需要真实 API Key，不读取个人笔记。

2026-10-04 检查结果：40 项自动化测试通过，类型检查通过，差异检查通过。覆盖独立进程笔记争用、最终读取期间取消、会话锁失效后禁止继续请求。独立代码复核确认本轮四项并发与路径保护问题已修复。全库中文化、工程工具迁移、MCP 集成和 Obsidian 实机操作仍未完成。

## Agent Client 集成与 2026-10-04 追加验收

Agent Client 原有主动提及发送内嵌 `resource`，文件附件发送 `file://` 形式的 `resource_link`；两者已通过真实 ACP 客户端入口验证。模型菜单使用当前插件实际调用的 `session/set_config_option`，不依赖旧版实验接口。提示词按钮明确要求读取 `Prompts/...` 时，模型可使用现有 `read_note` 工具读取指定提示词，然后处理当前用户请求。没有自动发现或批量读取提示词。

客户端请关闭自动批准，以及新聊天、关闭聊天时自动导出到 vault 的设置；只有单次批准可以写入。用户主动导出聊天属于另一个明确操作。凭据由启动环境注入或使用只读 Codex 登录，切勿把密钥填入库内插件配置。MCP 只读和导航工具可通过显式配置接通；笔记变更使用第一方安全工具，不支持任意 MCP 写入。

自动化：42 项 ACP 测试通过，包含主动选区、附件越界拒绝、模型列表、切换后实际请求模型和进程重启后模型恢复；类型检查通过。新增行为均在 Agent Client/ACP 预先确认的公开入口先红后绿。

真实订阅：扩展后的 `bun run scripts/verify_codex_acp.ts --live` 已在独立合成测试库通过中文流式回答（6 分片）、指定提示词文件读取与执行、主动提供的未保存选区三项。测试只输出状态，不输出令牌或真实笔记。以上是协议与真实模型证据，不代表点击 Obsidian 按钮或原生界面已经验收；原生 Obsidian 与移动端仍待用户手测。

## 独立发行运行文件

维护者执行 `bun scripts/build_pi_runtime.ts`，生成 `dist/ai-runtime/pi-acp.js`。候选构建把该文件放到 `scripts/ai-runtime/pi-acp.js`。它是包含依赖的单个 Bun ESM 文件，AI 功能需要 Bun 1.3.14；日常非 AI 功能不需要 Bun，不启动常驻服务。构建不读取认证，运行时才按配置取得认证。

Pi 官方 `registerBunOAuthFlows` 静态注册独立运行需要的 OAuth 模块。运行文件仅处理文本及 Markdown 上下文，不包含原本未启用的图片处理功能；图片处理调用明确报错。构建不携带源码映射、开发机绝对路径、凭据或会话。

Agent Client 候选默认配置如下，参数均为独立数组项，不使用不存在的 vault 路径占位符。客户端以当前 vault 根目录作为启动 cwd。

```json
{
  "defaultAgentId": "personal-life-os-pi",
  "autoAllowPermissions": false,
  "debugMode": false,
  "customAgents": [{
    "id": "personal-life-os-pi",
    "displayName": "Personal Life OS · Pi",
    "command": "bun",
    "args": ["run", "./scripts/ai-runtime/pi-acp.js"],
    "env": [
      {"key": "LIFE_OS_AUTH", "value": "codex"},
      {"key": "LIFE_OS_PROVIDER", "value": "openai-codex"},
      {"key": "LIFE_OS_MODEL", "value": "gpt-6.1-sol"}
    ],
    "enabled": true
  }],
  "exportSettings": {"autoExportOnNewChat": false, "autoExportOnCloseChat": false}
}
```

用户首次使用确认本机已安装 Bun、Codex 已登录。如果 Obsidian 图形环境找不到 `bun`，在 Agent Client 设置中把命令改为本人机器上的 Bun 可执行文件绝对路径；发行包不预填该路径。保持默认库根工作目录。如果选择其他工作目录，应自行把脚本参数设置为安装库中运行文件的绝对路径。其他供应商的密钥应通过 Obsidian 进程继承的环境变量提供，不能写入库内 env 配置。

`tests/acp/built-runtime.test.ts` 把产物复制到系统临时目录，使用没有项目依赖的独立合成库验证握手、中文请求、选区和附件。构建文件也通过了 `bun scripts/verify_codex_acp.ts --live --runtime dist/ai-runtime/pi-acp.js` 的真实中文流、提示词读取、选区验收。工具真实验收可通过同样的 `--runtime` 参数指定发行文件。

候选构建现在对锁定的 Agent Client 0.12.1 生成库外缓存补丁：聊天正文和标题、cwd、embedId 索引均存入用户主目录下的私有缓存，普通 data.json 不保存 savedSessions。补丁不修改当前 `.obsidian`，不迁移旧历史。原始上游插件仍有库内缓存行为，不能直接升级覆盖补丁。设计见 [缓存方案](agent-client-cache-proposal.md)，实际验证结果见 [最终开发验收](chinese-life-os-final-acceptance.md)；原生界面仍需用户手测。

## 完整提示词工作流的剩余接口

“能读取并执行合成提示词”不等于 16 个业务提示词均已交付。现有 Prompt 还调用活动笔记、目录列表、检索、文档结构、属性修改、三级标题追加、看板局部修改、模板创建、打开笔记及插件命令。

Pi 1.0.0 的 `@earendil-works/pi-mcp` 提供 `McpClient`、`StdioTransport` 和 `StreamableHttpTransport`，可承载 ACP 的 `session/new.mcpServers`。只读工具应使用明确名称白名单，不因远端描述声称安全就开放写入；`vault_patch`、`vault_write`、删除、移动以及任意 `command_execute` 不得直接透传。写入需要本地读取当前内容，生成准确差异，经 ACP 单次批准，再在冲突检查后提交。通用 MCP schema 本身不能保证远端写入与所批准差异相同。

现装 Agent Client 创建会话时实际传入 `mcpServers: []`，没有从自定义 Agent 的 env 自动转换 MCP 配置。现装 Obsidian 有 Local REST API 插件，未发现提供此处所需工具的 Obsidian MCP 插件。仅实现 ACP MCP 参数支持不能让原生提示词自动获得宿主能力，还须配置受信的宿主连接，且连接凭据不得进入 vault。

根 AGENTS 限制仍优先：不直接读取任务总表、不删除或重写日志/静修/规划、不绕过知识层事务。旧 Prompt 中与这些限制冲突的步骤必须修订为允许的工作流，而不是通过更宽的工具权限实现。

## 显式 MCP 与安全工具配置

ACP `session/new` / `session/load` 的非空 `mcpServers` 优先。Agent Client 传空列表时，只有显式设置 `LIFE_OS_MCP_CONFIG` 才读取配置，且该变量必须指向库外普通 JSON 文件，最大 64 KiB。最多 4 个服务器，不搜索默认配置，不保存连接凭据到会话。HTTP 仅允许 HTTPS 或本机 HTTP；不支持旧 SSE。stdio 可执行文件使用绝对路径，仅继承配置显式列出的环境变量，不继承模型密钥。

库外配置例子：

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

这是格式示例，不会创建或自动启动该服务。地址必须改为本人已配置且受信的 Obsidian MCP；`OBSIDIAN_MCP_AUTH` 由启动环境提供完整请求头值。不要把其值写入 Agent Client 的库内设置。stdio 形式使用 `command`、`args` 与 `env: [{"name":"SERVER_TOKEN","valueEnv":"OBSIDIAN_MCP_TOKEN"}]`。缺失环境变量、库内配置、无效配置和连接失败都会明确报错，不静默回退。

只读/导航白名单为 `active_file_get_path`、`vault_read`、`vault_list`、`vault_get_document_map`、`search_simple`、`tag_list`、`open_file`、`command_list`，模型看到名称为 `mcp_<服务名>_<工具名>`。有范围要求的工具必须在 schema 中提供且只提供一个可识别的路径参数（path/file/file_path/filePath/folder/directory），执行时检查库内路径；模糊 schema 不注册。搜索必须有明确目录和查询，不接受任务总表目录。远端结果最多 64 KiB，取消信号传入 MCP。服务本身必须受信：工具名与声明不是对恶意服务器实现的沙箱。

第一方工具：

| 工具 | 行为与限制 |
| --- | --- |
| `read_note` | 明确路径的 Markdown，不读取任务总表 |
| `list_notes` | 明确非根目录，只列当前层文件名/子目录，最多200项，不读正文 |
| `search_notes` | 明确指定最多32篇笔记，字面查询，返回来源与行号；不全库扫描；读取总量2 MiB，最多100命中 |
| `append_note` | 现有唯一 H2/H3 末尾追加，默认H2；任务总表仅Inbox/收件箱 |
| `set_note_property` | 现有单行标量/字符串列表属性，不新增/重命名键；dq/wheel为1至10整数，habit为布尔值 |
| `patch_note_section` | 仅项目、人物、写作、书籍的现有H2/H3内准确原文唯一替换；不改标题 |
| `move_board_card` | 项目或写作看板两个现有列之间移一张完整卡片，两列变化一次审批，不改其他卡片和设置块 |

写工具共用跨进程锁、完整原文/新文差异审批、批准后内容及文件身份复核、取消检查和原子替换。外部编辑器不遵守锁，最后一次检查与替换之间仍存在跨应用竞争窗口，不能宣称绝对 CAS。拒绝、取消或已观测到冲突都不提交。未知 MCP 写不能绕过这些工具。

## 16 个提示词的交付与手测矩阵

以下是协议能力与人工交互边界，不是原生 Obsidian 点击验收通过记录。未接 MCP 时，所有“当前笔记”必须由用户主动提供路径/选区；不能猜测活动文件。提示词中的通用工具名按同等安全能力映射到上表第一方工具。

| 提示词 | 已有能力 | 用户原生操作或明确限制 |
| --- | --- | --- |
| 01 早晨开始 | 指定周期笔记、项目/人物任务搜索、往年今日、批准追加 | 缺失日记由用户点击创建；任务总表结果由任务仪表盘提供 |
| 02 日终教练 | 读取问题与记录、逐项更新dq/habit、追加收获感恩 | 用户亲自回答评分；也可自行点击原生评分对话框 |
| 03 周回顾 | 读取本周日记、统计与对照、H3追加回顾 | 缺失周记由用户创建；不改日记正文 |
| 04 静修准备 | 按确认范围列举/读取、趋势与项目整理 | 用户确认抽样范围并创建/打开静修笔记 |
| 05 静修引导 | 逐节追加本人回答、更新wheel属性、读取规划 | 规划和静修既有正文不重写；表格/占位改写由用户原生完成，或批准追加补充；新项目原生创建 |
| 06 任务整理 | 可对用户提供的任务查询结果给出精确分类建议 | 不读取或重写任务总表；用户提供仪表盘结果并在原生任务界面应用 |
| 07 会前准备 | 指定人物/项目/日记搜索、议程、会议记录追加；人物/项目章节任务勾选 | 其他受保护来源任务在原生界面勾选 |
| 08 项目启动 | 目标/任务章节patch与追加、people/due/quarter属性、看板移卡、日志追加 | 用户创建空项目并等待Templater；复杂多行属性使用原生属性编辑 |
| 09 看板整理 | 读取看板与链接、问题表、逐卡完整差异移列 | 新建笔记、删除卡片和归档命令由用户原生操作 |
| 10 写作流程 | 来源读取、草稿章节修改、status与单行sources、看板移卡 | 不复制日记原文；新笔记及复杂结构在原生界面处理 |
| 11 SEO检查 | 人工规则审查、写作章节与属性补丁 | 用户点击SEO检查/展示结果；MCP可列出命令但不自动执行 |
| 12 研究收集 | 阅读剪藏/路由规则，提供可复制摘要 | Pi不具备claude-obsidian知识层事务，归档交由具备该技能的环境；不直接写wiki/inbox |
| 13 趋势分析 | 按范围读取属性/相关记录、统计与批准追加季末概括 | 用户选择范围，不推测缺失数值 |
| 14 今日重点 | 周意图、项目/人物任务查询与排序 | 任务总表由用户提供仪表盘结果；不足三项如实说明 |
| 15 健康检查 | 已确认目录分批列表、属性/链接/示例分析 | 不读隐藏配置或密钥；根目录敏感配置存在性、知识层lint由用户或对应技能检查 |
| 16 引导设置 | 读取配置与规划，起草建议，批准追加规划 | 配置列表/birthdate、示例删除与模板调整由用户原生设置；不以通用工具改系统目录 |

这些人工步骤是产品现有原生操作或明确权限边界，不把它们报告成模型执行成功。可在会话中继续等待用户完成，再读取更新后的明确目标推进后续步骤。

## 本轮最终自动化与真实请求记录

2026-10-04：完整 `bun test tests/acp` 64项通过、186个断言，随后新增的编译产物 MCP 用例单独通过（5个断言）。根 TypeScript 检查及本轮文件差异检查通过。MCP 覆盖协议入参、库外配置、环境变量认证、stdio、Streamable HTTP、库内配置拒绝、缺失环境变量拒绝，以及编译产物实际调用。新写工具覆盖准确差异、批准/拒绝、编辑器冲突、记录正文保护、任务总表保护和看板设置保留。

`bun scripts/verify_codex_tools.ts --live --runtime dist/ai-runtime/pi-acp.js` 正常退出，七项均通过：批准追加、重启恢复、拒绝追加、流式取消、取消后继续、批准更新每日评分属性、批准H3追加。先前的构建产物中文流式回复、提示词读取及选区上下文三项亦通过。全部使用独立合成库，没有读取真实笔记；没有把协议或真实模型结果记作原生Obsidian点击验收。
