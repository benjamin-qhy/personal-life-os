# 工作流 5：每日阅读

视频对应 11:51 至 14:11，介绍 Mike 的每日圣经阅读。这套模板也适用于其他有计划的日常阅读：用阅读计划、章节笔记、研读笔记和主题索引把内容串起来。圣经是现有脚本支持的示范材料，并不要求你采用同一阅读内容。

阅读是可选模块。构建不含阅读的独立模板时，使用构建命令的 `--without-reading` 选项；不会改动当前笔记库。如果在自己的笔记库中停用阅读，可移除 `09 Reading/`，并在 `Templates/Daily Note.md` 中移除 `[!reading]` 提示块。你也可以把它用于每季度一本书、一门课程或系列文章：在 `Reading Plan.md` 中按章节安排任务，在 `Chapters/` 中保存章节笔记，再用研读笔记链接相关章节。

## 两种笔记粒度

| | 章节笔记 | 经节笔记 |
| --- | --- | --- |
| 路径示例 | `09 Reading/Chapters/Genesis 1.md` | `09 Reading/Verses/Genesis 1.1.md` |
| 用途 | 每日阅读计划 | 研读笔记、主题索引和书籍笔记的链接目标 |
| 完整示例数量 | 1,189 | 31,102 |

## 阅读计划

`09 Reading/Reading Plan.md` 为每个章节安排一个带计划日期（⏳）的任务。每日笔记中的阅读提示块通过 Tasks 查询显示今天及之前安排、尚未完成的章节；未读章节会继续出现，读完后直接勾选即可。

维护者可以生成完整计划：

```bash
bun scripts/generate_reading_plan.ts --start 2026-09-01 --days 365 > "09 Reading/Reading Plan.md"
```

`--order canonical` 使用默认经卷顺序，`--order chronological` 使用内置的时间顺序，`--days` 指定计划天数。命令会写入指定输出文件，请先确认目标文件和起始日期。普通阅读与勾选任务不需要 Bun。

## 生成章节与经节笔记

```bash
bun scripts/split_bible.ts path/to/kjv.txt --out "09 Reading"
```

输入为纯文本，每行一节，格式为 `Book Chapter:Verse<TAB>Text`，即书名、章号、节号、制表符和正文。生成器输出 `Chapters/<Book> <N>.md`，包含章节正文及经节链接；同时输出 `Verses/<Book> <N>.<V>.md`，包含前后经节导航。首次为约三万篇经节笔记建立索引可能需要一些时间。

## 建立交叉参考

- 使用 `Templates/Study Note.md` 创建研读笔记，并链接提到的经节。打开经节的本地图谱，即可找到相关研读笔记与主题页。
- `09 Reading/Topics/` 中的主题页用于组织内容索引。
- 可以在经节笔记上使用 `#highlight`、`#topic/...` 等标签记录重点。
- 在书籍笔记中用 `^quote-1` 这样的块标识保存引文，写作时通过块引用复用。

[Mike 的原始圣经资源](https://download.mikeschmitz.com/bible)
