import { NextResponse } from "next/server";
import type { ContentKind, ParamDef, PendingTarget, TargetConfig } from "@/types";
import { generateId } from "@/lib/id";

export const runtime = "nodejs";

interface ConfirmTargetBody {
  /** 用户在确认页确认（可能微调）后的接入草稿。 */
  pendingTarget: PendingTarget;
  /** 接入时粘贴的对接文档原文（可选，存档用）。 */
  rawDoc?: string;
}

/**
 * 用户确认 Agent 接入草稿后，真正生成可用接口（v4.4）。
 *  - Agent 的 save_target 只产 pending 草稿（不写库）；用户在确认页核对三项真实有效后才调此接口。
 *  - 转为 TargetConfig：script.verified=true、status=tested_ok、source='agent'。
 *  - 仅返回 target，由前端存入 IndexedDB（与既有目标持久化一致，服务端不持有用户数据）。
 */
export async function POST(request: Request) {
  let body: ConfirmTargetBody;
  try {
    body = (await request.json()) as ConfirmTargetBody;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  const pending = body.pendingTarget;
  if (!pending || typeof pending !== "object") {
    return NextResponse.json({ error: "缺少接入草稿 pendingTarget" }, { status: 400 });
  }
  if (!pending.code?.trim()) {
    return NextResponse.json({ error: "草稿缺少脚本代码 code" }, { status: 400 });
  }

  const target: TargetConfig = {
    id: generateId(),
    name: pending.name?.trim() || "未命名接口",
    type: "custom",
    contentKind: coerceCapability(pending.capability),
    source: "agent",
    inputParams: normalizeParams(pending.inputParams),
    apiKeyRef: pending.apiKeyRef || undefined,
    status: "tested_ok",
    rawDoc: body.rawDoc,
    script: {
      lang: "python",
      code: pending.code,
      verified: true,
      lastTestInput: pending.lastTestInput,
      lastTestOutput: pending.lastTestOutput,
      outputDir: pending.outputDir,
    },
  };

  return NextResponse.json({ target });
}

function coerceCapability(raw: unknown): ContentKind {
  if (raw === "multimodal" || raw === "image") return raw;
  return "text";
}

function normalizeParams(raw: unknown): ParamDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = (item ?? {}) as Record<string, unknown>;
    const type = obj.type;
    return {
      name: typeof obj.name === "string" ? obj.name : "",
      type:
        type === "number" || type === "boolean" || type === "image"
          ? type
          : "string",
      required: Boolean(obj.required),
      desc: typeof obj.desc === "string" ? obj.desc : undefined,
    };
  });
}
