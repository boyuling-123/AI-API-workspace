import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";
import type { CallbackHandlerMethods } from "@langchain/core/callbacks/base";
import { z } from "zod";
import { ROOT_CONTEXT, trace, SpanStatusCode, type Span } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { AGENT_SCENARIOS, type AgentExperiment, type AgentObservation, type AgentScenario } from "../lib/agentObservability";

/** Fixed synthetic nodes; the StateGraph scheduler and retry engine are real. */
export async function runLangGraphMock(): Promise<AgentExperiment> {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  const tracer = provider.getTracer("eval-platform-langgraph-callbacks", "1.0.0");
  const active = new Map<string, Span>();
  const timestamp = () => performance.timeOrigin + performance.now();
  const State = new StateSchema({ value: z.number() });
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 8));

  try {
    for (const scenario of ["workflow", "retry"] as const satisfies readonly AgentScenario[]) {
      let attempts = 0;
      let observedAttempts = 0;
      const callbacks: CallbackHandlerMethods = {
        // Core 1.2.9 runtime passes parentRunId fourth and runName eighth (its .d.ts differs).
        handleChainStart(_chain, _inputs, runId, parentRunId, _tags, metadata, _runType, runName) {
          const root = !parentRunId && runName === scenario;
          const node = metadata?.langgraph_node;
          if (!root && !(runName === node && (node === "select" || node === "lookup"))) return;
          const parent = parentRunId ? active.get(parentRunId) : undefined;
          if (!root && !parent) throw new Error("MISSING_FRAMEWORK_PARENT");
          if (node === "lookup") observedAttempts += 1;
          const span = tracer.startSpan(root ? AGENT_SCENARIOS[scenario] : node === "select"
            ? "路由节点（固定规则）" : `库存工具（Mock，第 ${observedAttempts} 次）`, {
            startTime: timestamp(),
            attributes: {
              "eval.kind": node === "lookup" ? "tool" : "agent", "eval.mock": true,
              ...(root ? { "eval.scenario": scenario } : {}),
              ...(node === "lookup" ? { "eval.attempt": observedAttempts, "eval.retry": observedAttempts > 1 } : {}),
            },
          }, parent ? trace.setSpan(ROOT_CONTEXT, parent) : ROOT_CONTEXT);
          active.set(runId, span);
        },
        handleChainEnd(_outputs, runId) {
          const span = active.get(runId);
          if (span) { span.setStatus({ code: SpanStatusCode.OK }); span.end(timestamp()); active.delete(runId); }
        },
        handleChainError(_error, runId) {
          const span = active.get(runId);
          if (span) { span.setStatus({ code: SpanStatusCode.ERROR }); span.setAttribute("eval.error", "mock_node_failure"); span.end(timestamp()); active.delete(runId); }
        },
      };
      const graph = new StateGraph(State)
        .addNode("select", async () => { await pause(); return { value: 1 }; })
        .addNode("lookup", async (state) => {
          attempts += 1;
          await pause();
          if (scenario === "retry" && attempts === 1) throw new Error("FIXED_MOCK_FAILURE");
          return { value: state.value + 1 };
        }, { retryPolicy: { maxAttempts: 2, initialInterval: 1, jitter: false, logWarning: false,
          retryOn: (error) => error instanceof Error && error.message === "FIXED_MOCK_FAILURE" } })
        .addEdge(START, "select").addEdge("select", "lookup").addEdge("lookup", END).compile();
      const result = await graph.invoke({ value: 0 }, { runName: scenario, callbacks: [callbacks], recursionLimit: 6 });
      if (result.value !== 2 || attempts !== (scenario === "retry" ? 2 : 1) || active.size !== 0) throw new Error("INVALID_GRAPH_EXECUTION");
    }
    await provider.forceFlush();
    const milliseconds = (time: [number, number]) => time[0] * 1000 + time[1] / 1e6;
    const spans = exporter.getFinishedSpans().map<AgentObservation>((span) => ({
      traceId: span.spanContext().traceId, spanId: span.spanContext().spanId, parentSpanId: span.parentSpanContext?.spanId,
      name: span.name, kind: span.attributes["eval.kind"] as AgentObservation["kind"],
      startTimeMs: milliseconds(span.startTime), endTimeMs: milliseconds(span.endTime),
      status: span.status.code === SpanStatusCode.ERROR ? "error" : "ok",
      attributes: Object.fromEntries(Object.entries(span.attributes).filter(
        (entry): entry is [string, string | number | boolean] => entry[0].startsWith("eval.") && ["string", "number", "boolean"].includes(typeof entry[1]),
      )),
    })).sort((a, b) => a.startTimeMs - b.startTimeMs);
    if (spans.length !== 7) throw new Error("INCOMPLETE_FRAMEWORK_CALLBACKS");
    return {
      schemaVersion: 1, source: "local-langgraph-mock-otel", createdAt: new Date().toISOString(),
      framework: { name: "@langchain/langgraph", version: "1.4.14", coreVersion: "1.2.9", execution: "StateGraph", nodes: "mock", events: "callbacks" },
      instrumentation: { name: "@opentelemetry/sdk-trace-base", version: "2.11.0" },
      modelCalls: 0, tokens: null, modelCost: null, spans,
    };
  } finally { await provider.shutdown(); }
}
