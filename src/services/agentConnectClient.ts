import type { AgentStreamEvent, PendingTarget, TargetConfig } from "@/types";
import { emitPetStatus } from "@/lib/petBus";

/**
 * 前端发起 Agent 自动接入（v4.4），消费 /api/agent-connect 的 SSE 流。
 * 每收到一个 AgentStreamEvent 调一次 onEvent，由 UI 实时展示进度。
 * 支持 AbortSignal 取消。
 */
export async function startAgentConnect(
  doc: string,
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  // 彩蛋：接入开始 → 宠物忙碌（只读状态、不影响业务）。
  emitPetStatus({ status: "busy", scene: "agent" });
  await streamAgentConnect({ doc }, withPetStatus(onEvent), signal);
}

/**
 * 包裹 onEvent：在转发事件给业务的同时，根据事件类型给宠物切表情。
 * 纯旁路监听，不改动事件本身、不影响业务消费。
 */
function withPetStatus(
  onEvent: (event: AgentStreamEvent) => void
): (event: AgentStreamEvent) => void {
  return (event) => {
    if (event.type === "error") {
      emitPetStatus({ status: "sad", scene: "agent" });
    } else if (event.type === "done") {
      emitPetStatus({ status: "happy", scene: "agent" });
    }
    onEvent(event);
  };
}

/**
 * Agent 调 ask_user 提问后，用户回答续跑同一会话（带 sessionId + answer）。
 */
export async function resumeAgentConnect(
  sessionId: string,
  answer: string,
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  // 彩蛋：用户回答后续跑 → 宠物继续忙碌。
  emitPetStatus({ status: "busy", scene: "agent" });
  await streamAgentConnect({ sessionId, answer }, withPetStatus(onEvent), signal);
}

/** 统一发起请求并消费 SSE 流。 */
async function streamAgentConnect(
  body: { doc: string } | { sessionId: string; answer: string },
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch("/api/agent-connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // 忽略非 JSON 错误体。
    }
    onEvent({ type: "error", error: `接入请求失败：${message}` });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 以空行分隔的 SSE 事件块。
    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const rawBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const event = parseEventBlock(rawBlock);
      if (event) onEvent(event);
      separatorIndex = buffer.indexOf("\n\n");
    }
  }
}

/** 解析一个 SSE 事件块（仅取 data: 行）。 */
function parseEventBlock(block: string): AgentStreamEvent | null {
  const dataLines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  if (dataLines.length === 0) return null;
  const json = dataLines.join("\n");
  try {
    return JSON.parse(json) as AgentStreamEvent;
  } catch {
    return null;
  }
}

/**
 * 用户确认接入草稿后，转为正式 TargetConfig（/api/confirm-target）。
 * 返回的 target 由调用方存入 IndexedDB。
 */
export async function confirmTarget(
  pendingTarget: PendingTarget,
  rawDoc?: string
): Promise<TargetConfig> {
  const response = await fetch("/api/confirm-target", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingTarget, rawDoc }),
  });
  const data = (await response.json()) as { target?: TargetConfig; error?: string };
  if (!response.ok || !data.target) {
    throw new Error(data.error ?? `确认接入失败（HTTP ${response.status}）`);
  }
  return data.target;
}
