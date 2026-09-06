import { z } from "zod";
import { summarizeAgentExperiment, type AgentExperiment } from "./agentObservability";

const schema = z.object({
  schemaVersion: z.literal(1), source: z.literal("local-langgraph-mock-otel"), createdAt: z.iso.datetime(),
  framework: z.object({ name: z.literal("@langchain/langgraph"), version: z.literal("1.4.14"), coreVersion: z.literal("1.2.9"),
    execution: z.literal("StateGraph"), nodes: z.literal("mock"), events: z.literal("callbacks") }).strict(),
  instrumentation: z.object({ name: z.literal("@opentelemetry/sdk-trace-base"), version: z.literal("2.11.0") }).strict(),
  modelCalls: z.literal(0), tokens: z.null(), modelCost: z.null(),
  spans: z.array(z.object({
    traceId: z.string().regex(/^[a-f0-9]{32}$/), spanId: z.string().regex(/^[a-f0-9]{16}$/),
    parentSpanId: z.string().regex(/^[a-f0-9]{16}$/).optional(),
    name: z.enum(["顺序工作流", "失败重试", "路由节点（固定规则）", "库存工具（Mock，第 1 次）", "库存工具（Mock，第 2 次）"]),
    kind: z.enum(["agent", "tool"]), startTimeMs: z.number().min(0).max(8.64e15), endTimeMs: z.number().min(0).max(8.64e15),
    status: z.enum(["ok", "error"]),
    attributes: z.object({ "eval.kind": z.enum(["agent", "tool"]), "eval.mock": z.literal(true),
      "eval.scenario": z.enum(["workflow", "retry"]).optional(), "eval.attempt": z.union([z.literal(1), z.literal(2)]).optional(),
      "eval.retry": z.boolean().optional(), "eval.error": z.literal("mock_node_failure").optional() }).strict(),
  }).strict()).length(7),
}).strict();

export function parseLangGraphExperiment(value: unknown): AgentExperiment {
  const result = schema.parse(value);
  const byId = new Map(result.spans.map((span) => [span.spanId, span]));
  if (byId.size !== 7) throw new Error("INVALID_FRAMEWORK_SPANS");
  for (const span of result.spans) {
    if (span.endTimeMs < span.startTimeMs) throw new Error("INVALID_FRAMEWORK_TIME");
    if (span.parentSpanId) {
      const parent = byId.get(span.parentSpanId);
      if (!parent || parent.parentSpanId || parent.traceId !== span.traceId ||
        parent.startTimeMs > span.startTimeMs || parent.endTimeMs < span.endTimeMs) throw new Error("INVALID_FRAMEWORK_PARENT");
    }
  }
  const summaries = summarizeAgentExperiment(result);
  if (summaries.length !== 2 || summaries[0].scenario !== "workflow" || summaries[1].scenario !== "retry" ||
    summaries[0].spanCount !== 3 || summaries[1].spanCount !== 4 || summaries[0].errorSteps !== 0 || summaries[1].errorSteps !== 1 ||
    summaries[0].retries !== 0 || summaries[1].retries !== 1 || summaries.some((summary) => summary.status !== "ok")) {
    throw new Error("INVALID_FRAMEWORK_SUMMARY");
  }
  return result;
}
