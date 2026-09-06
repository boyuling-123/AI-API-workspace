import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLangGraphRunner, EXPERIMENT_ENV } from "@/server/langgraphExperiment";
import { parseLangGraphExperiment } from "@/lib/langgraphExperiment";
import { summarizeAgentExperiment } from "@/lib/agentObservability";
import { buildTraceInspector } from "@/lib/agentTraceInspector";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function fakeLaunch() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    kill: vi.fn(() => { queueMicrotask(() => child.emit("close", null)); return true; }),
  });
  const launch = vi.fn(() => child as unknown as ChildProcess);
  return { child, launch, run: createLangGraphRunner(launch as unknown as typeof spawn, 50) };
}

describe("actual LangGraph child execution", () => {
  it("executes StateGraph and its own retry policy with real callbacks, no inherited environment", async () => {
    vi.stubEnv("LANGSMITH_TRACING", "true");
    vi.stubEnv("EVAL_SYNTHETIC_PARENT_ONLY", "must-not-inherit");
    const launch = vi.fn(spawn);
    const result = await createLangGraphRunner(launch as unknown as typeof spawn)();
    expect(launch.mock.calls[0][2]).toMatchObject({ env: EXPERIMENT_ENV, stdio: ["ignore", "pipe", "ignore"] });
    expect(launch.mock.calls[0][2]?.env).not.toHaveProperty("EVAL_SYNTHETIC_PARENT_ONLY");
    expect(result.framework).toMatchObject({ name: "@langchain/langgraph", version: "1.4.14", execution: "StateGraph", events: "callbacks" });
    expect(result).toMatchObject({ source: "local-langgraph-mock-otel", modelCalls: 0, tokens: null, modelCost: null });
    const summaries = summarizeAgentExperiment(result);
    expect(summaries.map(({ scenario, spanCount, toolCalls, errorSteps, retries, status }) =>
      ({ scenario, spanCount, toolCalls, errorSteps, retries, status }))).toEqual([
      { scenario: "workflow", spanCount: 3, toolCalls: 1, errorSteps: 0, retries: 0, status: "ok" },
      { scenario: "retry", spanCount: 4, toolCalls: 2, errorSteps: 1, retries: 1, status: "ok" },
    ]);
    for (const summary of summaries) expect(buildTraceInspector(result.spans.filter((span) => span.traceId === summary.traceId)).rows).toHaveLength(summary.spanCount);
    const retryTools = result.spans.filter((span) => span.traceId === summaries[1].traceId && span.kind === "tool");
    expect(retryTools.map((span) => [span.attributes["eval.attempt"], span.status])).toEqual([[1, "error"], [2, "ok"]]);
    expect(JSON.stringify(result)).not.toMatch(/must-not-inherit|inputs|outputs|api_key|stack/);
    expect(parseLangGraphExperiment(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("denies all six network transports before framework import, without affecting the host", () => {
    const originalFetch = globalThis.fetch;
    const child = spawnSync(process.execPath, [".langgraph-dist/langgraph/stdio.js", "--verify-network-guard"], {
      env: EXPERIMENT_ENV, encoding: "utf8", timeout: 10_000,
    });
    expect(child.status).toBe(0);
    expect(child.stderr).toBe("");
    expect(JSON.parse(child.stdout)).toEqual({ blocked: 6 });
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it("creates new trace IDs without retaining state between child runs", async () => {
    const run = createLangGraphRunner();
    const first = await run(), second = await run();
    expect(new Set([...first.spans, ...second.spans].map((span) => span.traceId)).size).toBe(4);
  });

  it("cancels an actual isolated child and can run again after process close", async () => {
    let child: ChildProcess | undefined;
    const launch = vi.fn((...args: Parameters<typeof spawn>) => { child = spawn(...args); return child; });
    const run = createLangGraphRunner(launch as unknown as typeof spawn);
    const controller = new AbortController();
    const pending = run(controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
    controller.abort();
    await assertion;
    expect(child?.signalCode).toBe("SIGKILL");
    expect((await run()).spans).toHaveLength(7);
  });

  it("rejects extra attributes, bad parents, invalid clocks, missing errors and non-Mock sources", async () => {
    const result = await createLangGraphRunner()();
    for (const mutate of [
      (r: typeof result) => { r.spans[0].attributes.unexpected = "synthetic-private"; },
      (r: typeof result) => { r.spans[1].parentSpanId = "0000000000000000"; },
      (r: typeof result) => { r.spans[0].endTimeMs = 0; },
      (r: typeof result) => { r.spans.forEach((span) => { span.status = "ok"; }); },
      (r: typeof result) => { r.source = "local-mock-otel"; },
      (r: typeof result) => { r.spans[1].spanId = r.spans[0].spanId; },
    ]) {
      const changed = structuredClone(result); mutate(changed);
      expect(() => parseLangGraphExperiment(changed)).toThrow();
    }
  });
});

describe("fixed process lifecycle", () => {
  it("does not launch a cancelled request", async () => {
    const { run, launch } = fakeLaunch();
    await expect(run(AbortSignal.abort())).rejects.toMatchObject({ code: "CANCELLED" });
    expect(launch).not.toHaveBeenCalled();
  });

  it("rejects concurrency and kills only its own child on cancellation", async () => {
    const { run, launch, child } = fakeLaunch();
    const controller = new AbortController();
    const pending = run(controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
    await expect(run()).rejects.toMatchObject({ code: "BUSY" });
    expect(launch).toHaveBeenCalledTimes(1);
    controller.abort();
    await assertion;
    expect(child.kill).toHaveBeenCalledExactlyOnceWith("SIGKILL");
  });

  it("times out a child and releases its busy slot", async () => {
    const { run, child } = fakeLaunch();
    await expect(run()).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(child.kill).toHaveBeenCalledExactlyOnceWith("SIGKILL");
    const next = run();
    child.emit("close", 1);
    await expect(next).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("bounds output and never reflects the process output or errors", async () => {
    const { run, child } = fakeLaunch();
    const pending = run();
    const assertion = expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE" });
    child.stdout.write("x".repeat(65537));
    await assertion;
    expect(child.kill).toHaveBeenCalledOnce();
    const broken = fakeLaunch();
    const invalid = broken.run();
    broken.child.stdout.end("synthetic-private-server-path");
    broken.child.emit("close", 0);
    await expect(invalid).rejects.toThrow("框架实验暂不可用");
  });

  it("handles missing executable and spawn failures without exposing raw errors", async () => {
    const { run, child } = fakeLaunch();
    const pending = run();
    child.emit("error", new Error("synthetic-private-path"));
    await expect(pending).rejects.toThrow("框架实验暂不可用");
    const throwing = (() => { throw new Error("synthetic-private-path"); }) as unknown as typeof spawn;
    await expect(createLangGraphRunner(throwing)()).rejects.toThrow("框架实验暂不可用");
  });
});
