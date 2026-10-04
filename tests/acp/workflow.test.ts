import { expect, test } from "bun:test";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION, type RequestPermissionRequest } from "@agentclientprotocol/sdk";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { copyTree } from "../../src/tooling/build-template";

async function workflow(input: { path: string; before: string; tool: string; args: Record<string, unknown>; allow?: boolean; duringApproval?: (path: string) => Promise<void> }) {
  await mkdir("build/acp-tests", { recursive: true });
  const root = await mkdtemp(resolve("build/acp-tests/workflow-"));
  const cwd = join(root, "vault"); const path = join(cwd, input.path);
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, input.before);
  const approvals: RequestPermissionRequest[] = [];
  let sent = false; let toolOutput = "";
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const body = await request.json() as { messages: { role: string; content: unknown }[] };
    toolOutput = JSON.stringify(body.messages.filter(message => message.role === "tool"));
    const delta = sent ? { role: "assistant", content: "完成" } : { role: "assistant", tool_calls: [{ index: 0, id: "operation", type: "function", function: { name: input.tool, arguments: JSON.stringify(input.args) } }] };
    sent = true;
    return new Response(`data: ${JSON.stringify({ id: "test", object: "chat.completion.chunk", created: 0, model: "test", choices: [{ index: 0, delta, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
  } });
  const child = Bun.spawn([process.execPath, resolve("src/acp/main.ts")], { stdin: "pipe", stdout: "pipe", stderr: "ignore", env: {
    PATH: process.env.PATH, LIFE_OS_PROVIDER: "test", LIFE_OS_MODEL: "test", LIFE_OS_BASE_URL: `http://127.0.0.1:${server.port}/v1`, LIFE_OS_API_KEY: "synthetic", LIFE_OS_SESSION_DIR: join(root, "sessions"),
  } });
  const timer = setTimeout(() => child.kill(), 10000);
  const client = new ClientSideConnection(() => ({ sessionUpdate() {}, async requestPermission(request) {
    approvals.push(request); await input.duringApproval?.(path);
    return { outcome: { outcome: "selected", optionId: input.allow === false ? "reject_once" : "allow_once" } };
  } }), ndJsonStream(new WritableStream({ write(chunk) { child.stdin.write(chunk); } }), child.stdout));
  try {
    await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    const { sessionId } = await client.newSession({ cwd, mcpServers: [] });
    await client.prompt({ sessionId, prompt: [{ type: "text", text: "执行合成工具验收" }] });
    return { content: await readFile(path, "utf8"), approvals, toolOutput };
  } finally { clearTimeout(timer); child.kill(); await child.exited; server.stop(true); await rm(root, { recursive: true, force: true }); }
}

test.each(["01 Journal/Daily/2026-10-04.md", "01 日记/每日/2026-10-04.md"])("每日评分 %s 经完整差异单次批准后只修改既有属性值", async path => {
  const before = "---\ndq_focus: 4\nhabit_walk: false\n---\n## 日记\n保留的合成记录\n";
  const result = await workflow({ path, before, tool: "set_note_property", args: { path, key: "dq_focus", value: 7 } });
  expect(result.approvals).toHaveLength(1);
  expect(result.approvals[0]?.toolCall.content?.[0]).toMatchObject({ type: "diff", oldText: before, newText: "---\ndq_focus: 7\nhabit_walk: false\n---\n## 日记\n保留的合成记录\n" });
  expect(result.content).toBe("---\ndq_focus: 7\nhabit_walk: false\n---\n## 日记\n保留的合成记录\n");
});

test.each(["01 Journal/Weekly/2026-W40.md", "01 日记/每周/2026-W40.md"])("三级标题追加 %s 保留相邻章节且仍需批准", async path => {
  const before = "## 回顾\n### 亮点\n合成原文\n### 下一步\n保留\n";
  const result = await workflow({ path, before, tool: "append_note", args: { path, heading: "亮点", level: 3, text: "合成补充" } });
  expect(result.approvals).toHaveLength(1);
  expect(result.content).toBe("## 回顾\n### 亮点\n合成原文\n\n合成补充\n\n### 下一步\n保留\n");
});

test("写作章节局部替换需要准确原文，批准后保留其他章节", async () => {
  const before = "## 正文\n旧的合成段落\n## 参考\n保留来源\n";
  const result = await workflow({ path: "06 Writing/Article.md", before, tool: "patch_note_section", args: { path: "06 Writing/Article.md", heading: "正文", before: "旧的合成段落", after: "新的合成段落" } });
  expect(result.approvals).toHaveLength(1);
  expect(result.content).toBe("## 正文\n新的合成段落\n## 参考\n保留来源\n");
});

test("列举仅返回明确指定目录内的笔记文件名", async () => {
  const result = await workflow({ path: "04 Projects/合成项目.md", before: "不能从列表泄漏正文", tool: "list_notes", args: { folder: "04 Projects" } });
  expect(result.toolOutput).toContain("合成项目.md");
  expect(result.toolOutput).not.toContain("不能从列表泄漏正文");
  expect(result.approvals).toHaveLength(0);
});

test("搜索只读取明确选中的笔记并返回命中行及来源", async () => {
  const result = await workflow({ path: "04 Projects/合成项目.md", before: "## 日志\n讨论 合成关键词\n未命中的合成秘密\n", tool: "search_notes", args: { paths: ["04 Projects/合成项目.md"], query: "合成关键词" } });
  expect(result.toolOutput).toContain("讨论 合成关键词");
  expect(result.toolOutput).toContain("04 Projects/合成项目.md");
  expect(result.toolOutput).not.toContain("未命中的合成秘密");
});

test.each(["rejected", "conflict"])("属性更新 %s 时不产生批准之外的改写", async mode => {
  const before = "---\nhabit_walk: false\n---\n## 日记\n合成原文\n";
  const changed = before + "编辑器新增\n";
  const result = await workflow({ path: "01 Journal/Daily/test.md", before, tool: "set_note_property", args: { path: "01 Journal/Daily/test.md", key: "habit_walk", value: true }, allow: mode !== "rejected", ...(mode === "conflict" ? { duringApproval: (path: string) => writeFile(path, changed) } : {}) });
  expect(result.content).toBe(mode === "conflict" ? changed : before);
});

test.each(["01 Journal", "02 Retreats", "03 Planning", "wiki", "inbox", "01 日记", "02 静修", "03 规划"])("%s 正文不允许局部重写，即使模型要求", async folder => {
  const path = `${folder}/合成.md`; const before = "## 正文\n合成记录\n";
  const result = await workflow({ path, before, tool: "patch_note_section", args: { path, heading: "正文", before: "合成记录", after: "被改写" } });
  expect(result.approvals).toHaveLength(0); expect(result.content).toBe(before);
});

test("搜索不能绕过任务总表读取限制", async () => {
  const result = await workflow({ path: "08 Tasks/Tasks.md", before: "禁止外传的合成任务", tool: "search_notes", args: { paths: ["08 Tasks/Tasks.md"], query: "合成" } });
  expect(result.toolOutput).not.toContain("禁止外传的合成任务");
  expect(result.toolOutput).toContain("不能直接读取");
});

test("项目人物列表属性在批准后保留维基链接", async () => {
  const before = "---\npeople: []\nstatus: active\n---\n## 预期成果\n保留\n";
  const result = await workflow({ path: "04 Projects/合成.md", before, tool: "set_note_property", args: { path: "04 Projects/合成.md", key: "people", value: ["[[合成人物]]"] } });
  expect(result.approvals).toHaveLength(1);
  expect(result.content).toBe("---\npeople: [\"[[合成人物]]\"]\nstatus: active\n---\n## 预期成果\n保留\n");
});

test("看板移卡一次审批展示两列差异，保留设置块和其他卡片", async () => {
  const before = "---\nkanban-plugin: board\n---\n## 想法\n- [ ] [[合成项目]]\n- [ ] [[保留卡片]]\n## 本季度\n\n%% kanban:settings\n```\n{}\n```\n%%\n";
  const result = await workflow({ path: "04 Projects/Projects Board.md", before, tool: "move_board_card", args: { path: "04 Projects/Projects Board.md", from: "想法", to: "本季度", card: "- [ ] [[合成项目]]" } });
  expect(result.approvals).toHaveLength(1);
  expect(result.content).toBe("---\nkanban-plugin: board\n---\n## 想法\n- [ ] [[保留卡片]]\n## 本季度\n\n- [ ] [[合成项目]]\n\n%% kanban:settings\n```\n{}\n```\n%%\n");
});

test("发行默认项目看板能够完成启动提示词规定的移卡步骤", async () => {
  const root = await mkdtemp(resolve("build/acp-tests/board-"));
  try {
    const live = join(root, "live"); const candidate = join(root, "candidate");
    const path = "04 项目/项目看板.md";
    await mkdir(join(live, "04 项目"), { recursive: true });
    await writeFile(join(live, path), "synthetic source board");
    await copyTree(live, candidate);
    const generated = await readFile(join(candidate, path), "utf8");
    const before = generated.replace("## 想法\n", "## 想法\n- [ ] [[合成项目]]\n");
    const prompt = await readFile("提示词/08 项目启动.md", "utf8");
    const target = /展示移到“## ([^”]+)”/.exec(prompt)?.[1];
    expect(target).toBeDefined();
    const result = await workflow({ path, before, tool: "move_board_card", args: { path, from: "想法", to: target, card: "- [ ] [[合成项目]]" } });
    expect(result.approvals).toHaveLength(1);
    expect(result.content).toContain("## 进行中\n\n- [ ] [[合成项目]]\n");
    expect(result.content.split("[[合成项目]]")).toHaveLength(2);
    expect(result.content).not.toContain("## 本季度");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("目录列表可按明确日期前缀缩小范围", async () => {
  const result = await workflow({ path: "01 Journal/Daily/2025-01-01.md", before: "旧年度合成正文", tool: "list_notes", args: { folder: "01 Journal/Daily", prefix: "2026-10-" } });
  expect(result.toolOutput).not.toContain("2025-01-01.md");
  expect(result.toolOutput).toContain("entries");
});

test("中文写作目录经单次准确审批修改章节", async () => {
  const path = "06 写作/合成文章.md";
  const before = "## 正文\n合成旧段落\n## 参考\n保留\n";
  const result = await workflow({ path, before, tool: "patch_note_section", args: { path, heading: "正文", before: "合成旧段落", after: "合成新段落" } });
  expect(result.approvals).toHaveLength(1);
  expect(result.content).toBe("## 正文\n合成新段落\n## 参考\n保留\n");
});

test.each(["08 任务/任务总表.md", "08 任务/Tasks.md", "08 Tasks/任务总表.md", "08 TASKS/TASKS.MD"])("任务总表新旧与混合路径 %s 均不能读取", async path => {
  const result = await workflow({ path, before: "任务隐私合成哨兵", tool: "read_note", args: { path } });
  expect(result.toolOutput).not.toContain("任务隐私合成哨兵");
  expect(result.toolOutput).toContain("任务总表不直接读取");
});

test.each(["模板", "提示词", "系统", "使用指南", "00 仪表盘", "09 阅读", "Templates", "Prompts", "Meta", "Guide", "00 Dashboards", "09 Reading"])("中文系统目录 %s 不能直接追加", async folder => {
  const path = `${folder}/合成.md`, before = "## 记录\n保留\n";
  const result = await workflow({ path, before, tool: "append_note", args: { path, heading: "记录", text: "不得写入" } });
  expect(result.approvals).toHaveLength(0); expect(result.content).toBe(before);
});

test("中文项目看板移卡仍只请求一次准确差异审批", async () => {
  const path = "04 项目/项目看板.md";
  const before = "---\nkanban-plugin: board\n---\n## 想法\n- [ ] [[合成项目]]\n## 进行中\n";
  const result = await workflow({ path, before, tool: "move_board_card", args: { path, from: "想法", to: "进行中", card: "- [ ] [[合成项目]]" } });
  expect(result.approvals).toHaveLength(1);
  expect(result.content).toBe("---\nkanban-plugin: board\n---\n## 想法\n## 进行中\n\n- [ ] [[合成项目]]\n\n");
});

test.each(["search_notes", "set_note_property", "append_note"])("中文任务总表的 %s 不可绕过捕获限制", async tool => {
  const path = "08 任务/任务总表.md", before = "---\nstatus: active\n---\n## 收件箱\n合成任务\n## 已完成\n不得改写\n";
  const args = tool === "search_notes" ? { paths: [path], query: "合成" } : tool === "set_note_property" ? { path, key: "status", value: "done" } : { path, heading: "已完成", text: "不得写入" };
  const result = await workflow({ path, before, tool, args });
  expect(result.approvals).toHaveLength(0); expect(result.content).toBe(before); expect(result.toolOutput).not.toContain("合成任务");
});
test("中文任务总表只能按批准差异捕获到已有收件箱", async () => {
  const path = "08 任务/任务总表.md", before = "## 收件箱\n\n## 已完成\n保留\n";
  const result = await workflow({path,before,tool:"append_note",args:{path,heading:"收件箱",text:"- [ ] 合成捕获"}});
  expect(result.approvals).toHaveLength(1); expect(result.content).toBe("## 收件箱\n\n- [ ] 合成捕获\n\n## 已完成\n保留\n");
});
test("旧路径请求不会静默读取另一条中文路径", async () => {
  const result = await workflow({path:"04 项目/合成.md",before:"不应从新路径读取的合成内容",tool:"read_note",args:{path:"04 Projects/合成.md"}});
  expect(result.toolOutput).not.toContain("不应从新路径读取的合成内容");expect(result.approvals).toHaveLength(0);
});
