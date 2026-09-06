import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { executePlatformAction, safeActionError, PlatformActionError } from "@/server/platformActions";
import { ArchiveError, LocalArchiveReader } from "@/server/localArchiveReader";
import { GET } from "@/app/api/platform-actions/route";
import { ACTION_ERRORS, PLATFORM_ACTION_NAMES } from "@/lib/platformActions";
import { runPlatformAction } from "@/services/platformActionClient";
import { actionArchiveFixture } from "../helpers/actionArchiveFixture";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() { const value = await actionArchiveFixture(); roots.push(value.root); return value; }
const request = (query = "action=get_platform_capabilities", headers: Record<string, string> = { "x-eval-archive": "local-read" }) => new Request(`http://127.0.0.1:3100/api/platform-actions?${query}`, { headers });

describe("real read-only platform actions", () => {
  it("discovers exactly two actions without opening an archive or calling a model", async () => {
    const archiveSummary = vi.fn();
    const result = await executePlatformAction({ name: "get_platform_capabilities", arguments: {} }, { archiveSummary });
    expect(result).toMatchObject({ schemaVersion: 1, transport: "stdio", modelCalls: 0 });
    if (result.action !== "get_platform_capabilities") throw new Error("wrong action");
    expect(result.tools.map((tool) => tool.name)).toEqual(PLATFORM_ACTION_NAMES);
    expect(archiveSummary).not.toHaveBeenCalled();
  });

  it("rejects arbitrary names, data, paths, missing/array/null args and extra envelope fields", async () => {
    const archiveSummary = vi.fn();
    for (const input of [null, {}, [], { name: "delete_project", arguments: {} }, { name: "get_archive_summary" },
      { name: "get_archive_summary", arguments: null }, { name: "get_archive_summary", arguments: [] },
      { name: "get_archive_summary", arguments: { path: "private-path" } },
      { name: "get_archive_summary", arguments: {}, extra: true }]) {
      await expect(executePlatformAction(input, { archiveSummary })).rejects.toMatchObject({ code: "INVALID_ACTION", message: ACTION_ERRORS.INVALID_ACTION });
    }
    expect(archiveSummary).not.toHaveBeenCalled();
  });

  it("reuses real archive audit and explicitly excludes future raw fields from results", async () => {
    const f = await fixture();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const reader = await LocalArchiveReader.create(f.root, "synthetic");
    const original = await reader.summary();
    const result = await executePlatformAction({ name: "get_archive_summary", arguments: {} }, {
      archiveSummary: async () => ({ ...original, root: f.root, rows: ["private-value"], counts: { ...original.counts, "private-count": 1 } }),
    });
    expect(result).toMatchObject({ action: "get_archive_summary", modelCalls: 0, summary: original });
    expect(JSON.stringify(result)).not.toMatch(/synthetic-id|private-|eval-action-fixture|prompt|output/);
    expect(await readFile(f.shard)).toEqual(f.bytes);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("replaces filesystem and even custom archive error messages with safe constants", async () => {
    for (const error of [new Error("private-path"), new ArchiveError("INVALID_ARCHIVE", "private-payload")]) {
      await expect(executePlatformAction({ name: "get_archive_summary", arguments: {} }, { archiveSummary: async () => { throw error; } }))
        .rejects.toMatchObject({ code: "ARCHIVE_UNAVAILABLE", message: ACTION_ERRORS.ARCHIVE_UNAVAILABLE });
    }
    expect(safeActionError(new PlatformActionError("INVALID_ACTION", 400)).message).toBe(ACTION_ERRORS.INVALID_ACTION);
  });

  it("GET executes the same action with no-store, and returns true archive aggregates", async () => {
    const f = await fixture();
    vi.stubEnv("EVAL_ARCHIVE_CONFIG", f.config);
    const result = await GET(request("action=get_archive_summary"));
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    const body = await result.json();
    expect(body).toMatchObject({ ok: true, data: { summary: { provenance: "synthetic", totalRecords: 2, uniqueRecordIds: 1 } } });
    expect(JSON.stringify(body)).not.toContain(f.root);
  });

  it("rejects cross-origin / cross-site / missing opt-in / remote Host requests", async () => {
    const cases: Record<string, string>[] = [{}, { "x-eval-archive": "local-read", origin: "https://invalid.example" },
      { "x-eval-archive": "local-read", "sec-fetch-site": "cross-site" },
      { "x-eval-archive": "local-read", host: "invalid.example:3100" }];
    for (const headers of cases) {
      const response = await GET(request(undefined, headers));
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ ok: false, code: "LOCAL_ONLY" });
    }
  });

  it("rejects unknown, repeated, oversized or missing URL parameters", async () => {
    for (const query of ["", "action=delete_project", "action=get_archive_summary&path=private", "action=get_archive_summary&action=get_archive_summary", `action=${"x".repeat(150)}`]) {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "INVALID_ACTION", error: ACTION_ERRORS.INVALID_ACTION });
    }
  });

  it("unconfigured archives fail safely while capability discovery still works", async () => {
    const f = await fixture();
    vi.stubEnv("EVAL_ARCHIVE_CONFIG", `${f.root}/missing-private-file.json`);
    const response = await GET(request("action=get_archive_summary"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "NOT_CONFIGURED", error: ACTION_ERRORS.NOT_CONFIGURED });
    expect((await GET(request())).status).toBe(200);
  });

  it("the browser client never displays arbitrary server error bodies and validates action identity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    for (const body of [{ ok: false, error: "private-server-error" }, { ok: false, code: "__proto__" }, { ok: true, data: { action: "wrong" } }]) {
      fetchMock.mockResolvedValueOnce(Response.json(body));
      await expect(runPlatformAction("get_archive_summary")).rejects.toThrow(ACTION_ERRORS.SERVICE_UNAVAILABLE);
    }
    fetchMock.mockResolvedValueOnce(new Response("private-non-json"));
    await expect(runPlatformAction("get_archive_summary")).rejects.toThrow(ACTION_ERRORS.SERVICE_UNAVAILABLE);
    fetchMock.mockRejectedValueOnce(new Error("private-network-error"));
    await expect(runPlatformAction("get_archive_summary")).rejects.toThrow(ACTION_ERRORS.SERVICE_UNAVAILABLE);
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false, code: "NOT_CONFIGURED" }, { status: 503 }));
    await expect(runPlatformAction("get_archive_summary")).rejects.toThrow(ACTION_ERRORS.NOT_CONFIGURED);
  });
});
