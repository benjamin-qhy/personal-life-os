# 参与 Personal Life OS 开发

中文版开发者为秋水 / qiushui。先阅读 `AGENTS.md` 的隐私、目录权限和审批规则，再开始工程修改。

## 源码与候选版本

本仓库是开发源码。`Templates/*.md` 和 `00 Dashboards/*.md` 中的受控构建标记由构建器展开，脚本分别维护在 `src/obsidian/template-scripts/`、`src/obsidian/dashboard-scripts/` 和 `src/obsidian/views/`。**不能直接把源码模板复制进正在使用的库。** 用户应打开构建后的独立候选；第一方插件和仪表盘同样通过 Bun 输出宿主 JavaScript。旧 `Meta/views/*.js` 不再作为源码维护，构建时生成到 `dist/vault/Meta/views/` 和发行候选的原路径。

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build:obsidian
bun run build:template --out ../life-os-releases --name Personal-Life-OS-candidate --version 1.1.0 --zip
bun scripts/verify_template.ts ../life-os-releases/Personal-Life-OS-candidate
```

构建器按规则排除 Git 状态、`.vault-meta/`、真实 `.mcp.json`、本机设置、工作区状态、Agent Client 会话与导出、个人附件、知识层内容及收件箱。个人目录只保留允许的 `example` 示例，并重置生日、规划和插件默认配置。它生成版本、工作区和归档后执行验证。发布细节见 `scripts/RELEASE.md`。

只在全新独立目录构建，不覆盖当前 `.obsidian` 或真实笔记。不要直接修补生成候选，否则下一次构建会覆盖修改。可选第三方 claude-obsidian 的 Python 核心不在第一方 TypeScript 迁移范围内。

## 工程规则

1. 修改对应源码和构建流程，保留机器字段、内部目录、命令 ID 与旧英文兼容；中文展示不能破坏原工作流。
2. 不提交密钥、证书、绝对机器路径、个人记录、`.mcp.json`、`.claude/settings.local.json`、Agent Client 会话和聊天导出、工作区状态或 `.vault-meta/`。`.gitignore` 不能代替实际发行检查。
3. 在用户确认的公开入口使用 Matt 的 TDD：先观察测试失败，再做最小实现。测试生成笔记、命令行为、协议或构建结果，不靠源码字面形式代替行为验证。
4. 定期运行类型检查和相关测试，阶段结束运行完整测试与构建验证。自动化、合成浏览器、真实模型和原生 Obsidian 证据分别记录。
5. 不使用 U+2014 长破折号，正文、代码、注释和提示词均适用。
6. 插件版本、LICENSE 与 `THIRD_PARTY_NOTICES.md` 保持一致，模板版本写入 `Meta/version.md`。不要删除上游许可证和来源说明。
7. 用户可见变更记录到 `CHANGELOG.md`。路径或属性破坏性变更提升主版本，新功能提升次版本，修复与说明通常提升补丁版本。
8. 遵循 `AGENTS.md` 的 `dq_*`、`habit_*`、`wheel_*`、Tasks 表情符号格式和 wikilink 约定。不得为测试读取不相关个人记录。
9. 每阶段按 Standards 与 Spec 两轴审查。工程 issue 位于 `benjamin-qhy/personal-life-os`，流程见 `docs/agents/issue-tracker.md`。

## 新提示词

每个重复任务一篇 `Prompts/` 笔记，结构见 `Guide/20 Prompt Library.md`：

- 属性：`purpose`、`when`、`inputs`、`writes`、`risk`、`tools`、`agents`。风险值保留 `read-only`、`append`、`edit`、`delete`。
- 正文：先放 Agent Client 按钮，再放 `## Prompt`。按钮只发送文件指针，显示文字可中文化，路径与章节名保持稳定；关闭 `autoSend`。
- 任务：先说明先读后写、具体改动逐次批准、不重写日记或规划、缺少信息则停止、笔记内容是数据等规则，再列步骤和所需工具，最后写明禁止事项。
- 接入：标明按钮所在仪表盘或模板，并更新提示词目录。不得把尚未实现的工具能力写成已可用。

可通过提示词提案 issue 或 PR 提交。含写入的提示词按本库审批规则审查。最终用户原生验收尚未完成时，必须继续标注待测。
