import { ROOT_CONTEXT, SpanStatusCode, trace, type Span } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { AGENT_SCENARIOS, type AgentExperiment, type AgentObservation, type AgentScenario } from "@/lib/agentObservability";

function cancelled(): Error {
  return new Error("本地实验已停止，未保存未完成的结果。");
}

function pause(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(cancelled()); return; }
    const onAbort = () => { clearTimeout(timer); reject(cancelled()); };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, 8);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Real OTel spans around deterministic local stubs; no global provider or network exporter. */
export async function runLocalAgentExperiment(signal?: AbortSignal): Promise<AgentExperiment> {
  if (signal?.aborted) throw cancelled();
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  const tracer = provider.getTracer("eval-platform-local-agent-lab", "1.0.0");
  // One monotonic epoch anchor avoids independent span clocks drifting across parent/child bounds.
  const timestamp = () => performance.timeOrigin + performance.now();

  async function observe(
    name: string,
    kind: AgentObservation["kind"],
    parent: Span | undefined,
    run: (span: Span) => Promise<void>,
    attributes: Record<string, string | number | boolean> = {},
  ): Promise<void> {
    if (signal?.aborted) throw cancelled();
    const span = tracer.startSpan(name, {
      startTime: timestamp(),
      attributes: { "eval.kind": kind, "eval.mock": true, ...attributes },
    }, parent ? trace.setSpan(ROOT_CONTEXT, parent) : ROOT_CONTEXT);
    try {
      await run(span);
      if (signal?.aborted) throw cancelled();
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.setAttribute("eval.error", signal?.aborted ? "cancelled" : error instanceof Error && error.message === "simulated_timeout" ? "simulated_timeout" : "experiment_error");
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end(timestamp());
    }
  }

  const step = (name: string, kind: AgentObservation["kind"], parent: Span, attributes = {}) =>
    observe(name, kind, parent, () => pause(signal), attributes);
  const scenario = (id: AgentScenario, run: (root: Span) => Promise<void>) =>
    observe(AGENT_SCENARIOS[id], "agent", undefined, run, { "eval.scenario": id });

  try {
    await scenario("workflow", async (root) => {
      await step("模拟路由决策", "llm", root);
      await step("查询退款规则（本地桩）", "tool", root);
    });
    await scenario("retry", async (root) => {
      await step("模拟工具选择", "llm", root);
      try {
        await observe("库存查询：首次失败（故障注入）", "tool", root, async () => {
          await pause(signal);
          throw new Error("simulated_timeout");
        }, { "eval.attempt": 1 });
      } catch (error) {
        if (signal?.aborted || !(error instanceof Error) || error.message !== "simulated_timeout") throw error;
        await step("模拟重试决策", "llm", root);
        await step("库存查询：重试恢复（本地桩）", "tool", root, { "eval.attempt": 2, "eval.retry": true });
      }
    });
    await scenario("collaboration", async (root) => {
      await step("模拟任务分配", "llm", root);
      // Explicit parent contexts prevent concurrent branches from sharing the wrong parent.
      await Promise.all([
        observe("规则检查 Agent（模拟）", "agent", root, (agent) => step("读取规则（本地桩）", "tool", agent)),
        observe("库存检查 Agent（模拟）", "agent", root, (agent) => step("读取库存（本地桩）", "tool", agent)),
      ]);
    });
    await provider.forceFlush();
    const milliseconds = (time: [number, number]) => time[0] * 1000 + time[1] / 1e6;
    const spans = exporter.getFinishedSpans().map<AgentObservation>((span) => ({
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanContext?.spanId,
      name: span.name,
      kind: span.attributes["eval.kind"] as AgentObservation["kind"],
      startTimeMs: milliseconds(span.startTime),
      endTimeMs: milliseconds(span.endTime),
      status: span.status.code === SpanStatusCode.ERROR ? "error" : span.status.code === SpanStatusCode.OK ? "ok" : "unset",
      // Only our fixed synthetic attributes are exported, never process/resource metadata.
      attributes: Object.fromEntries(Object.entries(span.attributes).filter(
        (entry): entry is [string, string | number | boolean] => entry[0].startsWith("eval.") && ["string", "number", "boolean"].includes(typeof entry[1]),
      )),
    })).sort((a, b) => a.startTimeMs - b.startTimeMs);
    return {
      schemaVersion: 1, source: "local-mock-otel", createdAt: new Date().toISOString(),
      instrumentation: { name: "@opentelemetry/sdk-trace-base", version: "2.11.0" },
      modelCalls: 0, tokens: null, modelCost: null, spans,
    };
  } finally {
    await provider.shutdown();
  }
}
