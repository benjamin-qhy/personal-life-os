# Agent Client 会话缓存库外补丁草案

状态：用户已于 2026-10-04 同意推荐方案。候选补丁实现、双轴审查及自动化已完成，当前 `.obsidian` 未改；原生 Obsidian 与 Windows 设备操作待手测。结果见 [最终开发验收](chinese-life-os-final-acceptance.md)。

## 现有行为证据

只读检查当前第三方插件 `main.js`，未读取其 data.json 或任何笔记。

- `Kd` 会话存储类的 `getSessionsDir()` 返回 `${vault.configDir}/plugins/agent-client/sessions`。
- `saveSessionMessages()`、`loadSessionMessages()`、`readExistingMeta()`、`syncTranscriptTitle()`、`deleteSessionMessages()` 通过 vault.adapter 保存、读取及删除消息 JSON。
- `saveSession()`、`updateSessionTitle()`、`updateSession()`、`deleteSession()` 通过 `settingsAccess.updateSettings({savedSessions: ...})` 保存索引。索引包括 cwd、title、embedId、时间和 agentId。
- 插件 `saveSettings()` 直接 `saveData(this.settings)`，所以仅把 transcript 文件移走仍会把标题和路径写入 data.json。
- ChatPanel 在生成结束和消息更新时调用 `saveSessionMessages()`，并非只在主动导出时调用。`autoExportOnNewChat: false` 和 `autoExportOnCloseChat: false` 不会关闭这项缓存。

## 最小适配建议

只在构建发行候选时生成兼容补丁版本；保持第三方原始文件、版权及许可证，记录上游版本、输入 SHA256、补丁版本和产物 SHA256。补丁锚点不匹配必须停止构建，绝不“尽力”替换未知版本。

1. 提供桌面专用库外 SessionCache adapter，根目录为 `os.homedir()/.local/share/personal-life-os/agent-client/<sha256(realpath(vaultRoot))>/`。不接受来自笔记或会话消息的路径。macOS / Linux 目录权限 0700，文件权限 0600；Windows 以系统私有 ACL 实现同一访问目标，不把 POSIX 权限位当作 Windows 验收。拒绝任何符号链接和指向 vault 内的实际路径。会话 ID 仅接受受限字母、数字、下划线、短横线；不能把非法 ID 替换成可能碰撞的同一名字。
2. 保留 `Kd` 的公开方法及串行保存语义，替换 transcript 存取实现为该 adapter。临时文件 `wx` 写入、fsync、rename；操作失败抛出清晰错误，不回退 vault.adapter、不创建库内 sessions 目录。
3. 元数据索引单独保存为同一私有目录的 `index.json`。运行中仍保留内存 `settings.savedSessions` 以兼容现有 UI；`loadSettings()` 从库外索引加载它，`saveSettings()` 从序列化对象中移除 `savedSessions`，并在写普通设置时保持内存索引不变。所有 savedSessions 更新必须先持久化库外索引后发布内存状态；失败时不让 UI 假装保存成功。除 transcript 外，cwd/title/embedId 也不得进入库内配置。
4. 新发行候选的 savedSessions 为空，不迁移用户现用库内历史，不删除旧历史。若检测到旧字段，提示未迁移并要求专门迁移操作；补丁不自行读取真实旧 transcript。
5. 移动端不启用 ACP 和 SessionCache；不调用 Node 文件系统、不写库内替代缓存。非 AI 功能继续工作。
6. 关闭自动导出与自动审批。用户明确点导出聊天是独立行为，不等同于内部缓存。

## 验收入口

使用生成候选中的实际补丁插件和独立合成库，经用户操作入口创建聊天、结束回答、重命名、重启恢复和删除。断言会话内容、标题及 cwd 在库外，库内插件 data.json 无 savedSessions 与 transcript；另测 symlink/库内目录/不可写目录/损坏索引失败且无库内回退、移动端不启动缓存。保留现有 Agent Client UI、单次审批和插件许可证。

最终候选已同时覆盖 Pi 与客户端的库外会话存储。原始第三方 Agent Client 仍具有库内缓存行为，因此不能用未经本项目验证的上游更新覆盖兼容补丁。生成插件和生成界面回调的自动化证据不等同于原生设备验收，具体覆盖与未测项以最终开发验收记录为准。
