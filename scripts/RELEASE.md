# 发行检查清单

本地候选包不等于公开发行。不要直接归档工作笔记库，也不要对工作笔记库执行完整发行验证器。

## 自动化准备

此仓库是维护源码。维护者使用 Bun 1.3.14 和 TypeScript；Obsidian 用户使用生成的模板时无需安装 Bun，只有主动运行阅读生成工具时需要 Bun。

`scripts/template/defaults/` 是经过审阅的发行默认值，用于替换个人配置、规划、任务和知识状态。不要从个人笔记库复制内容来填充这些默认值。

在源码仓库运行：

```sh
bun install --frozen-lockfile --ignore-scripts
bun run typecheck
bun test
bun run verify:app
bun run verify:browser
bun scripts/verify_release_safety.ts
bun scripts/build_template.ts --out ../life-os-releases --name Personal-Life-OS-1.1.0-candidate --version 1.1.0 --zip
bun scripts/verify_template.ts ../life-os-releases/Personal-Life-OS-1.1.0-candidate
bun scripts/verify_archive_restore.ts ../life-os-releases/Personal-Life-OS-1.1.0-candidate-template-v1.1.0.zip
```

版本必须明确指定，输出目录必须位于源码库及其祖先目录之外。已有候选目录、ZIP 或摘要文件会被拒绝覆盖。构建失败会删除私有临时目录和本次创建的失败产物。

`bun run build:obsidian` 将第一方插件 TypeScript 源码生成到 `dist/obsidian/life-os-app`，不安装到现用 `.obsidian`。应用与浏览器检查使用该产物；模板构建也从源码生成插件，不复制现用插件代码。原生操作需在独立测试库验证。浏览器检查需要 Playwright Chromium，或用 `CHROMIUM_PATH` 指定本机 Chrome。

CI 使用同样的 Bun 工具链，运行合成测试和应用契约，构建独立副本，并验证临时解压后的每个文件。CI 不调用真实模型，不代表完成 Obsidian 原生验收，也不发布发行版。

维护源码、依赖、测试、凭据与会话不会进入模板包。包内仅保留独立阅读工具及本说明；构建和验证命令在源码仓库执行。`MANIFEST.sha256`、工作区状态、ZIP 和摘要文件是构建产物，不提交到源码。

## 构建与归档保护

插件设置在复制前按白名单重建，原始机器配置不会暂存。未知插件设置被省略。规划、任务和知识层只使用发行默认值；标准项目和写作看板重建为空，不读取原卡片或栏目。其他个人看板不会因为文件名含 Board 而获得豁免。

用户目录只保留明确标记为 `example` 的示例。桌面元数据、本机助手目录、密钥、依赖和会话被排除；外观与网页视图状态重置。仍需验证捕获和看板创建等功能。扫描通过不代表逐个人工审查过所有允许文件。

ZIP 验证包括完整 SHA256、条目路径、大小写冲突、符号链接和非常规文件拒绝、展开数量与大小限制、CRC，以及嵌入清单的精确文件集合和逐文件摘要。测试只解压到临时目录，结束后删除；它不验证个人笔记备份。

`--without-reading` 保留为独立变体，必须用全新名称构建并单独验收。移除目录不等于所有命令仍可用，任何未通过的检查都会阻止生成候选包。

## 分发前审查

- 检查最终 ZIP 的隐私、示例标记、路径和意外文件。
- 确认 README、CHANGELOG、应用 manifest、第三方声明和候选版本一致。
- 单独核查上游二进制来源及许可证。Kanban 的许可证为 GPL-3.0，不能因存在 LICENSE 就视为完成再分发审查。
- 包内 Local REST API 仍按既定策略启用回环 HTTP；在隔离原生测试中验证实际监听行为。
- 根据归档摘要完成 `Guide/23 Native Acceptance.md`，分别记录桌面、移动、供应商和 MCP 验收。
- 未实际验证时，不声称模型已连接、备份可恢复或原生功能通过。
- 提交、推送、创建发行版及公开发布仍需单独授权。

## 升级与回退

没有原地升级器。先关闭 Obsidian，完整备份旧库，在旁边解压新候选库。迁移个人内容、自定义配置和模板时检查冲突，不要整份覆盖 `.obsidian`。实际测试恢复后再决定是否停用旧库；不会自动清理归档或旧库。

## 当前验收边界

合成测试验证解析、控件和发行保护。真实模型验收单独运行、单独记录。Obsidian 原生、移动端、知识层及未执行项目必须明确标记为未测试。
