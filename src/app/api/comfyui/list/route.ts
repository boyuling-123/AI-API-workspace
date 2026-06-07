import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ListBody {
  serverUrl: string;
}

/**
 * ComfyUI 模型列表路由（M9）：从目标 ComfyUI 服务的 /object_info 拉取
 * 可用 checkpoint（CheckpointLoaderSimple.ckpt_name 的 enum）与
 * LoRA（LoraLoader.lora_name 的 enum），供接入面板下拉选择。
 *
 * 设计：收窄形态只需 checkpoint + lora 两个枚举，不暴露完整 object_info，
 * 减少前端解析负担，也避免把整张节点库回传到浏览器。
 */
export async function POST(request: Request) {
  let body: ListBody;
  try {
    body = (await request.json()) as ListBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  const serverUrl = body.serverUrl?.trim().replace(/\/$/, "");
  if (!serverUrl) {
    return NextResponse.json(
      { ok: false, error: "缺少 serverUrl" },
      { status: 400 }
    );
  }

  try {
    const [checkpoints, loras] = await Promise.all([
      fetchNodeEnum(serverUrl, "CheckpointLoaderSimple", "ckpt_name"),
      fetchNodeEnum(serverUrl, "LoraLoader", "lora_name"),
    ]);

    return NextResponse.json({ ok: true, checkpoints, loras });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ ok: false, error: message });
  }
}

interface ObjectInfoResponse {
  [nodeName: string]: {
    input?: {
      required?: Record<string, unknown>;
      optional?: Record<string, unknown>;
    };
  };
}

/**
 * 从 ComfyUI /object_info/{node} 解析某个输入字段的候选枚举。
 * ComfyUI 把枚举型输入表示为 [["选项A","选项B",...], {...}]，取第 0 个元素即候选列表。
 */
async function fetchNodeEnum(
  serverUrl: string,
  nodeName: string,
  fieldName: string
): Promise<string[]> {
  const response = await fetch(`${serverUrl}/object_info/${nodeName}`);
  if (!response.ok) {
    throw new Error(`拉取 ${nodeName} 失败：HTTP ${response.status}`);
  }
  const data = (await response.json()) as ObjectInfoResponse;
  const node = data[nodeName];
  const field =
    node?.input?.required?.[fieldName] ?? node?.input?.optional?.[fieldName];

  if (Array.isArray(field) && Array.isArray(field[0])) {
    return (field[0] as unknown[]).filter(
      (item): item is string => typeof item === "string"
    );
  }
  return [];
}
