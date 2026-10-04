# 工作流 7：写作与书库

视频对应 16:42 至 18:36。素材和草稿放在同一个笔记库中，减少寻找、复制和重新排版，把注意力留给写作。

## 素材与草稿相连

需要引用书籍笔记时，直接添加笔记链接，或通过 `![[Book#^quote-id]]` 嵌入某段引文。引文仍保留在原始笔记中，写作正文不必复制一份来源。

## 结构

| 类型 | 目录 | 看板文件 | 模板 | 完成后 |
| --- | --- | --- | --- | --- |
| 通讯 | `06 Writing/Newsletters` | `Newsletter Board` | `Templates/Newsletter.md` | 导出到通讯平台 |
| 视频脚本 | `06 Writing/YouTube Scripts` | `YouTube Board` | `Templates/YouTube Script.md` | 交给剪辑人员 |
| 文章 | `06 Writing/Articles` | `Article Board` | `Templates/Article.md` | 导出到发布平台 |
| 课程内容 | `06 Writing/Course Content` | `Course Board` | `Templates/Course Lesson.md` | 导出到课程平台 |
| 书籍笔记 | `07 Library/Book Notes` | 无 | `Templates/Book Note.md` | 作为写作素材 |

看板从想法收集逐步推进到大纲、起草、编辑、待发布和已发布。QuickAdd 的想法捕获命令会把卡片放入对应看板的待办栏。拖动卡片表示阶段变化；从卡片创建笔记时，使用该目录的模板，保留正确的属性和类型。

这些内容本身就是任务笔记：正文直接写在笔记中。它们与普通 `- [ ]` 行内任务不同，但仍可在笔记里添加需要执行的具体任务。

## 创作与助手

四种写作模板都保留创作协助与发布前 SEO 检查按钮。按钮读取 `Prompts/10 Writing Pipeline.md` 或 `Prompts/11 SEO Pre-publish Audit.md` 中的 `Prompt` 章节，处理当前笔记。操作前确认上下文，任何写入仍需要审阅目标和具体改动。

## 书库使用

用书籍模板记录三句话总结、核心观点、引文和对行动的影响。`status`、`author`、`rating` 等属性键保持原样，便于查询与仪表盘识别；正文使用中文。

- 捕获引文时立即添加 `^quote-1` 等块标识。
- 如实维护 `sources` 属性，并在正文链接实际来源。书籍笔记中的“引用本书的作品”查询会显示链接到本书的写作笔记。
- “将本页整理到知识库”按钮遵循研究捕获提示词，先检查和批准，再应用改动。
- 从空白页到定稿都留在 Obsidian，最后再导出。
