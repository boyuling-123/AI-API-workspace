import { beforeAll, describe, expect, it, vi } from "vitest";
import { serializeAgentExperiment, type AgentExperiment } from "@/lib/agentObservability";
import { OBSERVATION_FILE_ERROR, OBSERVATION_FILE_LIMIT, OBSERVATION_READ_ERROR, parsePortableAgentExperiment, readPortableAgentExperiment } from "@/lib/portableAgentExperiment";
import { runLocalAgentExperiment } from "@/services/runLocalAgentExperiment";
import { createLangGraphRunner } from "@/server/langgraphExperiment";

let manual: AgentExperiment, framework: AgentExperiment;
beforeAll(async () => {
  manual = await runLocalAgentExperiment();
  framework = await createLangGraphRunner()();
});
const copy = (value: AgentExperiment) => JSON.parse(serializeAgentExperiment(value)) as AgentExperiment;
const reject = (value: AgentExperiment) => expect(() => parsePortableAgentExperiment(serializeAgentExperiment(value))).toThrow(OBSERVATION_FILE_ERROR);

describe("bounded local observation file contract, using real producers", () => {
  it.each(["manual", "framework"])("roundtrips actual %s output without altering steps, but always marks unverified provenance", (source) => {
    const original = copy(source === "manual" ? manual : framework);
    const read = parsePortableAgentExperiment(serializeAgentExperiment(original));
    expect(read).toEqual({ ...original, provenance: { kind: "local-file", verification: "unverified" } });
    expect(parsePortableAgentExperiment(serializeAgentExperiment(read))).toEqual(read);
    expect(original).not.toHaveProperty("provenance");
  });

  it("does not accept a file claiming authenticated execution or drop its unknown provenance fields", () => {
    for (const provenance of [{ kind: "local-file", verification: "verified" }, { kind: "live", verification: "unverified" },
      { kind: "local-file", verification: "unverified", signedBy: "synthetic" }]) {
      expect(() => parsePortableAgentExperiment(JSON.stringify({ ...manual, provenance }))).toThrow(OBSERVATION_FILE_ERROR);
    }
  });

  it("rejects duplicate JSON keys including escaped and nested keys", () => {
    const text = serializeAgentExperiment(manual);
    for (const changed of [
      text.replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1'),
      text.replace('"schemaVersion": 1', '"schemaVersion": 1, "schema\\u0056ersion": 1'),
      text.replace('"eval.mock": true', '"eval.mock": false, "eval.mock": true'),
      text.replace('"name": "@opentelemetry/sdk-trace-base"', '"name": "hidden", "name": "@opentelemetry/sdk-trace-base"'),
    ]) expect(() => parsePortableAgentExperiment(changed)).toThrow(OBSERVATION_FILE_ERROR);
  });

  it("rejects malformed, deep, unsupported and oversized input without reflecting it", () => {
    for (const text of ["", "synthetic-private-path", "null", "[]", '{"x":"unterminated', '{"x":"\\q"}',
      "[".repeat(17) + "0" + "]".repeat(17), serializeAgentExperiment(manual) + "x", "中".repeat(22000), " ".repeat(OBSERVATION_FILE_LIMIT + 1)]) {
      expect(() => parsePortableAgentExperiment(text)).toThrow(OBSERVATION_FILE_ERROR);
    }
  });

  it("rejects extra or missing fields, wrong versions, arbitrary business payloads and non-Mock values", () => {
    for (const mutate of [
      (r: AgentExperiment) => { Object.assign(r, { prompt: "synthetic-private" }); },
      (r: AgentExperiment) => { Object.assign(r.spans[0], { input: "synthetic-private" }); },
      (r: AgentExperiment) => { r.spans[0].attributes.input = "synthetic-private"; },
      (r: AgentExperiment) => { Reflect.deleteProperty(r, "tokens"); },
      (r: AgentExperiment) => { Reflect.deleteProperty(r.spans[0], "status"); },
      (r: AgentExperiment) => { Object.assign(r, { schemaVersion: 2, modelCalls: 1 }); },
      (r: AgentExperiment) => { r.instrumentation.version = "other"; },
      (r: AgentExperiment) => { r.createdAt = "invalid"; },
      (r: AgentExperiment) => { r.spans[0].attributes["eval.mock"] = false; },
      (r: AgentExperiment) => { r.spans[0].name = "synthetic-private-name"; },
      (r: AgentExperiment) => { r.spans = [...r.spans, r.spans[0]]; },
    ]) { const changed = copy(manual); mutate(changed); reject(changed); }
  });

  it("rejects duplicate or zero IDs, broken graphs, clocks and scenario summaries", () => {
    for (const source of [manual, framework]) {
      for (const mutate of [
        (r: AgentExperiment) => { r.spans[1].spanId = r.spans[0].spanId; },
        (r: AgentExperiment) => { r.spans[0].spanId = "0".repeat(16); },
        (r: AgentExperiment) => { r.spans[0].traceId = "0".repeat(32); },
        (r: AgentExperiment) => { r.spans[1].parentSpanId = "a".repeat(16); },
        (r: AgentExperiment) => { r.spans[1].parentSpanId = r.spans[1].spanId; },
        (r: AgentExperiment) => { r.spans[1].traceId = "b".repeat(32); },
        (r: AgentExperiment) => { r.spans[1].startTimeMs = -1; },
        (r: AgentExperiment) => { r.spans[1].endTimeMs = 0; },
        (r: AgentExperiment) => { r.spans[1].endTimeMs = 8.64e15 + 1; },
        (r: AgentExperiment) => { r.spans[1].endTimeMs = r.spans[0].endTimeMs + 1000; },
        (r: AgentExperiment) => { r.spans[1].attributes["eval.scenario"] = "workflow"; },
        (r: AgentExperiment) => { r.spans[0].attributes["eval.scenario"] = "retry"; },
        (r: AgentExperiment) => { r.spans[0].attributes["eval.kind"] = "tool"; },
        (r: AgentExperiment) => { r.spans.find((span) => span.status === "error")!.status = "ok"; },
      ]) { const changed = copy(source); mutate(changed); reject(changed); }
    }
  });

  it("rejects unsupported source/framework combinations", () => {
    const changed = copy(manual); changed.framework = framework.framework; reject(changed);
    const noFramework = copy(framework); delete noFramework.framework; reject(noFramework);
    const wrongSource = copy(framework); wrongSource.source = "local-mock-otel"; reject(wrongSource);
  });

  it("accepts formatting changes without accepting changes to the contract", () => {
    const escaped = serializeAgentExperiment(manual).replace('"source"', '"sour\\u0063e"');
    expect(parsePortableAgentExperiment(escaped).spans).toEqual(copy(manual).spans);
    expect(parsePortableAgentExperiment(` \n${JSON.stringify(manual)}\t `).source).toBe(manual.source);
  });

  it("checks declared byte size before reading any content and checks actual text again", async () => {
    const text = vi.fn(async () => serializeAgentExperiment(manual));
    for (const size of [0, -1, NaN, Infinity, 0.5, OBSERVATION_FILE_LIMIT + 1]) {
      await expect(readPortableAgentExperiment({ size, text })).rejects.toThrow(OBSERVATION_FILE_ERROR);
    }
    expect(text).not.toHaveBeenCalled();
    await expect(readPortableAgentExperiment({ size: 1, text: async () => " ".repeat(OBSERVATION_FILE_LIMIT + 1) })).rejects.toThrow(OBSERVATION_FILE_ERROR);
    const actual = serializeAgentExperiment(manual);
    expect((await readPortableAgentExperiment({ size: new TextEncoder().encode(actual).length, text })).spans).toEqual(copy(manual).spans);
  });

  it("does not reflect a failed filesystem read", async () => {
    await expect(readPortableAgentExperiment({ size: 1, text: async () => { throw new Error("synthetic-private-path"); } })).rejects.toThrow(OBSERVATION_READ_ERROR);
  });
});
