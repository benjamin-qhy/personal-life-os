# 罗盘仪表盘

视频对应 18:36 至 20:46。组件读取 Markdown 属性生成视图，不需要手工复制统计数字。

| 组件 | 宿主产物 | 数据来源 |
| --- | --- | --- |
| 人生之轮 | `Meta/views/wheel.js` | 静修笔记中的 `wheel_*` 数值 |
| 每日问题、开关和时间范围 | `Meta/views/dailyquestions.js` | 每日笔记的 `dq_*` 数值 |
| 习惯、连续与间隔 | `Meta/views/habits.js` | 每日笔记的 `habit_*` 复选框 |
| 人生主题 | 笔记章节嵌入 | `03 Planning/Life Theme.md` 的主题章节 |
| 人生时间提醒 | `Meta/views/memento.js` | 配置中的 `birthdate` 与 `life_expectancy` |
| 捕获与规划快捷入口 | `Meta/views/quicklinks.js` | QuickAdd 命令与当前日期 |

另有独立的项目、每日问题、习惯和任务仪表盘，适合深入查看。

## 在其他笔记中调用视图

```dataviewjs
await dv.view("Meta/views/habits", { days: 28 });
await dv.view("Meta/views/dailyquestions", { from: "2026-07-01", to: "2026-09-30" });
await dv.view("Meta/views/wheel", { page: "02 Retreats/2026-Q2 Personal Retreat" });
await dv.view("Meta/views/week", { week: "2026-W35" });
```

## 配置与扩展

`Meta/Compass Config.md` 集中保存目录、前缀、问题、习惯、人生领域、生日和预期寿命。配置缺失时视图使用默认值，但需要真实数据的组件会保留空状态。

维护者在 TypeScript 源码中修改组件，再通过 Bun 构建宿主可运行的 JavaScript。不要直接修补独立候选中的 `Meta/views/*.js`，否则下一次构建会覆盖。通过 Dataview 的 `dv.view` 接口调用组件，并在合成笔记库验证数据与交互。
