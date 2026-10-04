# 搜索服务与 Vault Lens

[Vault Lens](https://github.com/jk-oster/obsidian-search-for-web) 通过 Obsidian 内的本地服务，在网页搜索结果和重访页面旁展示相关笔记。以下是模板选用服务的配置说明，历史安全评估不等同于对未来版本的保证。

| 插件 | 候选默认配置 | 原因 |
| --- | --- | --- |
| Local REST API 5.1.0 | 安装并启用，本地 HTTP 端口 27123 | 提供预览、编辑、追加、每日笔记和页面笔记功能；使用每次安装独立生成的 Bearer API Key，默认绑定 `127.0.0.1` |
| Omnisearch 1.30.1 | 安装并启用，HTTP 服务关闭 | 库内搜索提供 BM25 与容错；其 HTTP 接口无鉴权并允许跨域，启用后本地进程或网页可能查询索引 |

Omnisearch 的服务端口是 51361，历史扩展快速指南中的 51736 曾有误。没有明确需要时保持关闭。

发行配置中的 Local REST API 设置只包含 `{"enableInsecureServer": true}`。插件首次启动生成密钥与自签证书，并写回本机该插件的设置文件；因此运行后的 `.obsidian` 不能直接当成可分享的发行内容。

## 本机设置

1. 打开独立候选，明确决定是否关闭受限模式并加载插件。
2. 在 Local REST API 设置中确认 HTTP 服务位于 27123，复制本机 API Key。
3. 按 [Vault Lens 安装指南](https://vaultlens.com/getting-started.html) 安装浏览器扩展；原支持渠道包括 Chrome Web Store、Firefox Add-ons 和 Edge Add-ons。
4. 扩展连接设置选择 Local REST API、`http`、27123，粘贴密钥并填写当前库名称。
5. 查看连接状态，然后搜索 `Guide/00 Start Here.md` 中的普通词语，确认能找到该笔记。
6. 在合成测试库验证每日笔记和编辑入口，不先用真实日记试写。如果生成的笔记为空，应通过规范模板入口创建或填充，不要假定仅运行“替换模板”能自动补齐不存在的模板内容。
7. 如需要，可在 Obsidian 核心插件中开启 Web viewer。

## 权限与风险

- 只绑定回环地址，不设置 `bindingHost` 或 `DANGER_httpHost` 开放到网络。
- 默认使用本机 HTTP 27123，避免每次安装都要信任自签证书；HTTPS 27124 仍可选，证书更新和信任需要本机维护。共享机器需要更谨慎评估。
- API Key 相当于读写全库的密码。不要分享设置页截图；扩展可能将其保存在浏览器同步存储。插件的密码学重置功能会轮换密钥与证书。
- 浏览器编辑可能替换整篇笔记，与 Obsidian 并发编辑时可能由最后写入覆盖。先在测试库验证并保留备份。
- 第三方插件可能访问 Web viewer 的会话信息。需要密码保护的内容优先使用主浏览器。

## 发行检查与可选取舍

`scripts/build_template.ts` 在独立候选中重置服务器设置；`scripts/verify_template.ts` 拒绝包含已生成密钥和证书的候选。流程见 `scripts/RELEASE.md`。

默认启用服务是一项明确取舍：更保守的配置是安装但不启用，用户需要时再开启。本机 HTTP 加 Bearer Key 也不同于上游 HTTPS 优先的默认姿态。用户可以选择关闭桥接，日记、规划和任务仍可使用。
