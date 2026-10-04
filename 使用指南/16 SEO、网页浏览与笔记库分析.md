# 研究与发布工具

这些工具在生活工作流之上提供阅读资料、发现笔记和发布检查，均可按需使用。

## Web viewer

Obsidian 核心 Web viewer 可在应用内打开网页，与草稿并排查看，并通过保存到库与官方 Web Clipper 配合。默认候选配置开启广告拦截，保存位置指向 `07 书库`。部分配置键来自历史公开配置观察，首次使用应在设置中确认当前版本实际行为。

在“设置 → 核心插件 → Web viewer”选择外链打开方式、搜索引擎并清理浏览数据。涉及敏感账号时使用主浏览器；第三方插件与应用内网页共享同一宿主环境，不应把它当成隔离的秘密空间。

## SEO

[SEO](https://github.com/davidvkimball/obsidian-seo) 0.5.6（`seo`）用于准备发布的笔记，检查标题和描述长度、关键词、slug、标题层级、图片替代文本、链接、重复标题、阅读难度和字数，原插件评分范围为 40 至 100。

- 可运行当前笔记检查和全库检查，命令 ID 为 `seo:run-current`、`seo:run-global`，执行前确认当前版本存在这些命令。
- 扫描目录建议限制到 `06 写作`；只有确实发布书籍笔记时才添加 `07 书库`，日记不应面向搜索引擎检查。
- 外链检查需要网络，模板默认关闭。
- 原插件使用 `title`、`description`、`slug`、`keywords` 等可配置属性。写作模板保留 `subject`、`meta_description`、`slug`，如需对应评分，在 SEO 设置中明确映射。
- 该插件属于作者的 Vault CMS 项目，不依赖某个特定发布平台。

## Vault Lens

[Vault Lens](https://github.com/jk-oster/obsidian-search-for-web) 浏览器扩展原名 Obsidian Search for Web，可在搜索结果和重访页面旁展示相关库笔记。它需要库内搜索服务，设置与权限说明见 [[17 搜索服务|搜索服务]]。

## 组合使用

用 Web viewer 阅读，用 Web Clipper 捕获资料，用 Vault Lens 再次发现已有笔记，在 [[14 AI 助手与 Agent Client|助手]] 中明确提供素材以辅助起草，最后用 SEO 检查待发布内容。具体助手工具能力取决于当前适配层，不能假定所有外部功能已经接通。
