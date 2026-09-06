import { z } from "zod";
import { AGENT_SCENARIOS, summarizeAgentExperiment, type AgentExperiment } from "./agentObservability";
import { buildTraceInspector } from "./agentTraceInspector";
import { parseLangGraphExperiment } from "./langgraphExperiment";

export const OBSERVATION_FILE_LIMIT = 64 * 1024;
export const OBSERVATION_FILE_ERROR = "文件不符合本平台观测 JSON 格式，未替换当前结果。请使用本平台下载的完整 Mock 实验文件（版本 1，最多 64 KiB），不要手工补字段。";
export const OBSERVATION_READ_ERROR = "无法读取所选文件，当前结果保留。请重新选择本机文件。";

const schema = z.object({
  schemaVersion: z.literal(1), source: z.enum(["local-mock-otel", "local-langgraph-mock-otel"]),
  createdAt: z.iso.datetime(),
  framework: z.object({ name: z.literal("@langchain/langgraph"), version: z.literal("1.4.14"), coreVersion: z.literal("1.2.9"),
    execution: z.literal("StateGraph"), nodes: z.literal("mock"), events: z.literal("callbacks") }).strict().optional(),
  instrumentation: z.object({ name: z.literal("@opentelemetry/sdk-trace-base"), version: z.literal("2.11.0") }).strict(),
  modelCalls: z.literal(0), tokens: z.null(), modelCost: z.null(),
  provenance: z.object({ kind: z.literal("local-file"), verification: z.literal("unverified") }).strict().optional(),
  spans: z.array(z.object({
    traceId: z.string().regex(/^(?!0{32}$)[a-f0-9]{32}$/), spanId: z.string().regex(/^(?!0{16}$)[a-f0-9]{16}$/),
    parentSpanId: z.string().regex(/^(?!0{16}$)[a-f0-9]{16}$/).optional(),
    name: z.string().min(1).max(64), kind: z.enum(["agent", "llm", "tool"]),
    startTimeMs: z.number().min(0).max(8.64e15), endTimeMs: z.number().min(0).max(8.64e15), status: z.enum(["ok", "error"]),
    attributes: z.object({ "eval.kind": z.enum(["agent", "llm", "tool"]), "eval.mock": z.literal(true),
      "eval.scenario": z.enum(["workflow", "retry", "collaboration"]).optional(),
      "eval.attempt": z.union([z.literal(1), z.literal(2)]).optional(), "eval.retry": z.boolean().optional(),
      "eval.error": z.enum(["simulated_timeout", "mock_node_failure"]).optional() }).strict(),
  }).strict()).min(1).max(14),
}).strict();

const manualNames = [
  "顺序工作流", "模拟路由决策", "查询退款规则（本地桩）", "失败重试", "模拟工具选择",
  "库存查询：首次失败（故障注入）", "模拟重试决策", "库存查询：重试恢复（本地桩）", "并行协作",
  "模拟任务分配", "规则检查 Agent（模拟）", "读取规则（本地桩）", "库存检查 Agent（模拟）", "读取库存（本地桩）",
].sort();

// JSON.parse alone silently keeps the last duplicate key. Scan string tokens first,
// including escaped keys, and bound depth before passing to the standard parser.
function rejectAmbiguousJson(text: string): void {
  const stack: (Set<string> | null)[] = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "{") stack.push(new Set());
    else if (char === "[") stack.push(null);
    else if (char === "}" || char === "]") stack.pop();
    else if (char === '"') {
      const start = index++;
      while (index < text.length && text[index] !== '"') {
        if (text[index] === "\\") index++;
        index++;
      }
      let next = index + 1;
      while (/\s/.test(text[next] ?? "") && next < text.length) next++;
      if (text[next] === ":") {
        const keys = stack[stack.length - 1];
        const key = JSON.parse(text.slice(start, index + 1)) as string;
        if (!keys || keys.has(key)) throw new Error("DUPLICATE_KEY");
        keys.add(key);
      }
    }
    if (stack.length > 16) throw new Error("EXCESSIVE_DEPTH");
  }
}

export function parsePortableAgentExperiment(text: string): AgentExperiment {
  try {
    if (text.length > OBSERVATION_FILE_LIMIT || new TextEncoder().encode(text).length > OBSERVATION_FILE_LIMIT) throw new Error("SIZE");
    rejectAmbiguousJson(text);
    const result = schema.parse(JSON.parse(text));
    const declared = { ...result };
    delete declared.provenance;
    if (result.source === "local-langgraph-mock-otel") parseLangGraphExperiment(declared);
    else if (result.framework || result.spans.map((span) => span.name).sort().join("|") !== manualNames.join("|")) throw new Error("PROFILE");
    const byId = new Map(result.spans.map((span) => [span.spanId, span]));
    if (byId.size !== result.spans.length) throw new Error("DUPLICATE_SPAN");
    for (const span of result.spans) {
      if (span.attributes["eval.kind"] !== span.kind || (span.status === "error") !== Boolean(span.attributes["eval.error"])) throw new Error("ATTRIBUTES");
      if (span.parentSpanId) {
        const parent = byId.get(span.parentSpanId);
        if (!parent || parent.traceId !== span.traceId || span.startTimeMs < parent.startTimeMs || span.endTimeMs > parent.endTimeMs
          || span.attributes["eval.scenario"] !== undefined) throw new Error("PARENT");
      } else if (span.kind !== "agent" || span.name !== AGENT_SCENARIOS[span.attributes["eval.scenario"]!]) throw new Error("ROOT");
    }
    const summaries = summarizeAgentExperiment(result);
    const expected = result.source === "local-mock-otel" ? [[3, 1, 0, 0], [5, 2, 1, 1], [6, 2, 0, 0]] : [[3, 1, 0, 0], [4, 2, 1, 1]];
    if (summaries.length !== expected.length || new Set(summaries.map((item) => item.traceId)).size !== summaries.length) throw new Error("ROOT_COUNT");
    summaries.forEach((summary, index) => {
      if (summary.scenario !== Object.keys(AGENT_SCENARIOS)[index] || summary.status !== "ok" ||
        [summary.spanCount, summary.toolCalls, summary.errorSteps, summary.retries].join() !== expected[index].join()) throw new Error("SUMMARY");
      buildTraceInspector(result.spans.filter((span) => span.traceId === summary.traceId));
    });
    if (summaries.reduce((count, summary) => count + summary.spanCount, 0) !== result.spans.length) throw new Error("ORPHAN_TRACE");
    return { ...result, provenance: { kind: "local-file", verification: "unverified" } };
  } catch {
    throw new Error(OBSERVATION_FILE_ERROR);
  }
}

export async function readPortableAgentExperiment(file: Pick<File, "size" | "text">): Promise<AgentExperiment> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > OBSERVATION_FILE_LIMIT) throw new Error(OBSERVATION_FILE_ERROR);
  let text: string;
  try { text = await file.text(); } catch { throw new Error(OBSERVATION_READ_ERROR); }
  return parsePortableAgentExperiment(text);
}
