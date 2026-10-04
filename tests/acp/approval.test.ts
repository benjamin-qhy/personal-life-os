import { expect, test } from "bun:test";
import { approveChange } from "../../src/acp/approval";
import type { RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";

const change = { path: "/synthetic/notes/test.md", before: "旧内容", after: "新内容" };

test("审批请求展示完整差异，只有明确的单次允许才放行", async () => {
  let shown: RequestPermissionRequest | undefined;
  const allowed = await approveChange("session", "call", change, async (request) => {
    shown = request;
    return { outcome: { outcome: "selected", optionId: "allow_once" } };
  }, new AbortController().signal);
  expect(allowed).toBe(true);
  expect(shown?.toolCall.content).toEqual([{ type: "diff", path: change.path,
    oldText: change.before, newText: change.after }]);
  expect(shown?.options.map((option) => option.kind)).toEqual(["allow_once", "reject_once"]);
});

test.each<RequestPermissionResponse>([
  { outcome: { outcome: "selected", optionId: "reject_once" } },
  { outcome: { outcome: "cancelled" } },
  { outcome: { outcome: "selected", optionId: "unknown" } },
])("拒绝、取消或未知选择均不放行 %#", async (response) => {
  expect(await approveChange("session", "call", change, async () => response,
    new AbortController().signal)).toBe(false);
});

test("等待用户审批时取消立即结束，迟到的允许无效", async () => {
  const controller = new AbortController();
  let respond!: (value: RequestPermissionResponse) => void;
  const decision = new Promise<RequestPermissionResponse>((resolve) => { respond = resolve; });
  const result = approveChange("session", "call", change, () => decision, controller.signal);
  controller.abort();
  expect(await result).toBe(false);
  respond({ outcome: { outcome: "selected", optionId: "allow_once" } });
});

test("审批连接异常不放行", async () => {
  expect(await approveChange("session", "call", change, async () => { throw new Error("连接断开"); },
    new AbortController().signal)).toBe(false);
});
