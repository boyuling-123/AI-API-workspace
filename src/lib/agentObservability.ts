export const AGENT_SCENARIOS = {
  workflow: "顺序工作流",
  retry: "失败重试",
  collaboration: "并行协作",
} as const;

export type AgentScenario = keyof typeof AGENT_SCENARIOS;

export interface AgentObservation {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: "agent" | "llm" | "tool";
  startTimeMs: number;
  endTimeMs: number;
  status: "ok" | "error" | "unset";
  attributes: Record<string, string | number | boolean>;
}

export interface AgentExperiment {
  schemaVersion: 1;
  source: "local-mock-otel" | "local-langgraph-mock-otel";
  framework?: {
    name: "@langchain/langgraph";
    version: "1.4.14";
    coreVersion: "1.2.9";
    execution: "StateGraph";
    nodes: "mock";
    events: "callbacks";
  };
  createdAt: string;
  instrumentation: { name: "@opentelemetry/sdk-trace-base"; version: string };
  modelCalls: 0;
  tokens: null;
  modelCost: null;
  provenance?: { kind: "local-file"; verification: "unverified" };
  spans: AgentObservation[];
}

export interface AgentTraceSummary {
  traceId: string;
  scenario: AgentScenario;
  name: string;
  status: AgentObservation["status"];
  durationMs: number;
  spanCount: number;
  toolCalls: number;
  errorSteps: number;
  retries: number;
}

export function summarizeAgentExperiment(experiment: AgentExperiment): AgentTraceSummary[] {
  return experiment.spans.filter((span) => !span.parentSpanId).map((root) => {
    const spans = experiment.spans.filter((span) => span.traceId === root.traceId);
    const scenario = root.attributes["eval.scenario"] as AgentScenario;
    if (!Object.hasOwn(AGENT_SCENARIOS, scenario)) {
      throw new Error("未知的本地实验场景");
    }
    return {
      traceId: root.traceId,
      scenario,
      name: AGENT_SCENARIOS[scenario],
      status: root.status,
      // Use the root wall time: adding overlapping child durations inflates latency.
      durationMs: Math.max(0, root.endTimeMs - root.startTimeMs),
      spanCount: spans.length,
      toolCalls: spans.filter((span) => span.kind === "tool").length,
      errorSteps: spans.filter((span) => span.status === "error").length,
      retries: spans.filter((span) => span.attributes["eval.retry"] === true).length,
    };
  }).sort((a, b) => Object.keys(AGENT_SCENARIOS).indexOf(a.scenario) - Object.keys(AGENT_SCENARIOS).indexOf(b.scenario));
}

export function serializeAgentExperiment(experiment: AgentExperiment): string {
  return JSON.stringify(experiment, null, 2);
}
