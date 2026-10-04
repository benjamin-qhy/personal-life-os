---
date: {{lifeos-script:personal-retreat-1}}
quarter: {{lifeos-script:personal-retreat-2}}
tags:
  - retreat
{{lifeos-script:personal-retreat-3}}
---
> 笔记命名为 `YYYY-QN Personal Retreat`，例如 `2026-Q4 Personal Retreat`。仪表盘按此约定查找本季度静修，并读取 `wheel_*` 属性绘制人生之轮，无需改代码。

上次静修：[[02 Retreats/{{lifeos-script:personal-retreat-4}} Personal Retreat]] · 季度笔记：[[01 Journal/Quarterly/{{lifeos-script:personal-retreat-5}}]] · 去年同季度：[[02 Retreats/{{lifeos-script:personal-retreat-6}} Personal Retreat]]

留出一整段不受打扰的时间。只需这份笔记、几个小时，以及认真回答问题的意愿。

```agent
type: button
text: "准备个人静修"
prompt: "读取 Prompts/04 Retreat Prep.md，并按其 Prompt 章节处理当前打开的笔记；若无适用笔记，则使用当前周期。"
viewType: right-pane
```
```agent
type: button
text: "引导这次静修"
prompt: "读取 Prompts/05 Retreat Facilitation.md，并按其 Prompt 章节处理当前打开的笔记；若无适用笔记，则使用当前周期。"
viewType: right-pane
```

## 1. 回顾人生主题与核心价值观
它们是否仍有共鸣？如需调整，请回到源笔记逐项修改。
![[Life Theme#人生主题]]
![[Core Values#价值观]]

记录：
- 

## 2. 回顾日记
阅读最近 90 天的日记，观察努力评分趋势与反复出现的话题。
```dataviewjs
{{lifeos-script:personal-retreat-7}}
```
```dataviewjs
{{lifeos-script:personal-retreat-8}}
```
本季度收获：
```dataviewjs
{{lifeos-script:personal-retreat-9}}
```
值得注意的地方：
- 

## 3. 人生之轮
在顶部属性中为各领域的当前满意程度打 1 至 10 分，然后选择未来 90 天重点关注的一个领域。
```dataviewjs
{{lifeos-script:personal-retreat-10}}
```
未来 90 天的重点领域：
- 

为什么选择它：
- 

## 4. 回顾
### 第一部分：回顾上季度
并排打开上季度静修。意图是否落实？你是在改变，还是用不同措辞重写同样的目标？

做得好的地方：
- 

未如预期的地方：
- 

我的收获：
- 

### 第二部分：开始、停止、保持
| 开始 | 停止 | 保持 |
| --- | --- | --- |
|  |  |  |

## 5. 下一季度意图
最多三项，每项都应能转化为每周行动。
1. 
2. 
3. 

## 6. 检查理想一周
[[Ideal Week]] 是否为这些意图预留了时间？现在就调整。
![[Ideal Week#时间安排]]

需要调整的地方：
- 

## 7. 确定投入的项目
在 `04 Projects/` 创建或更新项目，设置 `quarter:` 为本季度，使其显示在季度笔记中。
- 

## 结束
用一句话概括本季度方向：
- 
