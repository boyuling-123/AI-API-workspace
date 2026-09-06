import { afterEach, expect, it, vi } from "vitest";
const run = vi.hoisted(() => vi.fn());
vi.mock("@/server/langgraphExperiment", async (original) => ({ ...await original<typeof import("@/server/langgraphExperiment")>(), runLangGraphExperiment: run }));
import { POST } from "@/app/api/experiments/langgraph/route";
import { ExperimentError } from "@/server/langgraphExperiment";

afterEach(() => run.mockReset());
const headers = { "x-eval-experiment": "langgraph-mock" };
const request = (suffix = "", init: RequestInit = {}) => new Request(`http://localhost:3002/api/experiments/langgraph${suffix}`, { method: "POST", headers, ...init });

it("requires loopback, same origin and explicit header before any execution", async () => {
  for (const req of [request("", { headers: {} }), request("", { headers: { ...headers, origin: "https://example.invalid" } }),
    request("", { headers: { ...headers, host: "example.invalid:3002" } }),
    request("", { headers: { ...headers, "sec-fetch-site": "cross-site" } }),
    new Request("http://example.invalid/api/experiments/langgraph", { method: "POST", headers })]) {
    expect((await POST(req)).status).toBe(403);
  }
  expect(run).not.toHaveBeenCalled();
});

it("rejects all queries and data bodies without running a graph", async () => {
  expect((await POST(request("?prompt=test"))).status).toBe(400);
  expect((await POST(request("", { body: JSON.stringify({ prompt: "synthetic" }) }))).status).toBe(400);
  expect(run).not.toHaveBeenCalled();
});

it("permits Next hostname normalization, disables caching, and forwards cancellation", async () => {
  run.mockResolvedValue({ source: "synthetic-route-test" });
  const req = request("", { headers: { ...headers, host: "127.0.0.1:3002", origin: "http://127.0.0.1:3002" } });
  const response = await POST(req);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(run).toHaveBeenCalledWith(req.signal);
});

it("returns controlled busy errors and hides unknown failures", async () => {
  run.mockRejectedValueOnce(new ExperimentError("BUSY", 409, "正在运行"));
  expect((await POST(request())).status).toBe(409);
  run.mockRejectedValueOnce(new Error("synthetic-private-server-path"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("synthetic-private");
});
