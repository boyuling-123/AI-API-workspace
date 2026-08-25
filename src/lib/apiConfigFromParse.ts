import type { ApiDocParseResult, ParamDef, TargetConfig } from "@/types";
import { generateId } from "@/lib/id";
import { sanitizeCapabilityList } from "@/config/capabilities";

/**
 * 把 AI 解读结果映射成一份 TargetConfig 草稿（v4 统一接入：AI 解析 → 填表）。
 * 纯函数、无副作用，便于单测与复用。
 *
 * 映射规则：
 * - endpoint        -> requestTemplate.url
 * - method          -> requestTemplate.method（缺省 POST）
 * - bodyTemplate    -> requestTemplate.bodyTemplate（缺省按 prompt 占位）
 * - preprocess      -> requestTemplate.preprocess（仅保留清单内合法项）
 * - suggestedKeyRef -> apiKeyRef
 * - requestParams   -> inputParams
 * - outputTextPath / outputImagePath -> requestTemplate 同名
 * - contentKind     -> contentKind（缺省 text）
 * - summary         -> 默认名称（用户可改）
 *
 * 产出 source='agent'，但全字段可手动改，与手动填写产出结构一致。
 */
export function mapParseResultToTargetConfig(
  parsed: ApiDocParseResult,
  rawDoc?: string
): TargetConfig {
  const inputParams: ParamDef[] = parsed.requestParams.map((param) => ({
    name: param.name,
    type: param.type,
    required: param.required,
    desc: param.desc,
  }));

  const bodyTemplate =
    parsed.bodyTemplate ?? JSON.stringify({ prompt: "{{prompt}}" });

  return {
    id: generateId(),
    name: deriveName(parsed),
    type: "custom",
    contentKind: parsed.contentKind ?? "text",
    source: "agent",
    status: "unverified",
    apiKeyRef: parsed.suggestedKeyRef ?? "",
    rawDoc,
    inputParams,
    requestTemplate: {
      url: parsed.endpoint ?? "",
      method: parsed.method ?? "POST",
      headers: [],
      bodyTemplate,
      stream: false,
      preprocess: sanitizeCapabilityList(parsed.preprocess),
      outputTextPath: parsed.outputTextPath ?? "",
      outputImagePath: parsed.outputImagePath ?? "",
    },
  };
}

/** 从摘要里取一个简短默认名，取不到则给占位名，用户保存前可改。 */
function deriveName(parsed: ApiDocParseResult): string {
  const summary = parsed.summary?.trim();
  if (summary) {
    const firstClause = summary.split(/[。.,，；;\n]/)[0]?.trim();
    if (firstClause) {
      return firstClause.length > 20 ? firstClause.slice(0, 20) : firstClause;
    }
  }
  return "新接入的目标";
}
