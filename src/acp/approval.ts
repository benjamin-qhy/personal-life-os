import type { RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";

export interface ProposedChange { readonly path: string; readonly before: string; readonly after: string }

/** 仅决定当前准确变更是否获批；调用者必须另行验证路径及审批后内容是否变化。 */
export async function approveChange(
  sessionId: string,
  toolCallId: string,
  change: ProposedChange,
  request: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return false;
  let onAbort: () => void = () => {};
  const cancelled = new Promise<undefined>((resolve) => {
    onAbort = () => resolve(undefined);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    const response = await Promise.race([cancelled, request({
      sessionId,
      toolCall: { toolCallId, title: "确认笔记变更", kind: "edit", status: "pending",
        locations: [{ path: change.path }],
        content: [{ type: "diff", path: change.path, oldText: change.before, newText: change.after }],
      },
      options: [
        { optionId: "allow_once", name: "允许本次变更", kind: "allow_once" },
        { optionId: "reject_once", name: "拒绝", kind: "reject_once" },
      ],
    })]);
    return !signal.aborted && response?.outcome.outcome === "selected" &&
      response.outcome.optionId === "allow_once";
  } catch { return false; }
  finally { signal.removeEventListener("abort", onAbort); }
}
