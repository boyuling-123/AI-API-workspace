import type { AgentStreamEvent } from "@/types";
import {
  runAgentConnect,
  resumeAgentConnect,
} from "@/services/agent/agentConnectService";

export const runtime = "nodejs";
export const maxDuration = 300;

interface AgentConnectBody {
  /** 新建接入：用户粘贴的对接文档原文。 */
  doc?: string;
  /** 续跑接入：Agent 提问后用户回答时回传的会话 id。 */
  sessionId?: string;
  /** 续跑接入：用户对 ask_user 提问的回答文本。 */
  answer?: string;
}

/**
 * Agent 自动接入（v4.4），SSE 流式。支持两种入参：
 *  - { doc }                  新建接入，启动 Agent 循环。
 *  - { sessionId, answer }    Agent 调 ask_user 暂停后，用户回答续跑同一会话。
 *
 * 循环中按需执行 run_script / install_package / save_target / ask_user。
 * 每步 AgentStreamEvent 以 SSE（data: <json>）实时推给前端；
 * done 附 pending 草稿待确认，ask 附 sessionId+question 暂停等用户回答。
 */
export async function POST(request: Request) {
  let body: AgentConnectBody;
  try {
    body = (await request.json()) as AgentConnectBody;
  } catch {
    return jsonError("请求体解析失败，需为合法 JSON", 400);
  }

  const doc = typeof body.doc === "string" ? body.doc.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const answer = typeof body.answer === "string" ? body.answer : "";
  const isResume = Boolean(sessionId);

  if (!isResume && !doc) {
    return jsonError("缺少对接文档 doc（或续跑所需的 sessionId）", 400);
  }
  if (isResume && !answer.trim()) {
    return jsonError("续跑需要 answer（用户对提问的回答）", 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentStreamEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        if (isResume) {
          await resumeAgentConnect(sessionId, answer, emit);
        } else {
          await runAgentConnect(doc, emit);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        emit({ type: "error", error: `接入过程异常：${message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
