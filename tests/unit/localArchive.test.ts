import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalArchiveReader, parseArchiveShard, readArchiveFile } from "@/server/localArchiveReader";
import { assertLocalArchiveRequest, readArchiveRequest } from "@/server/localArchiveAccess";
import { GET } from "@/app/api/local-archive/route";
import { archiveStatus } from "@/lib/localArchive";

const roots: string[] = [];
const wrap = (rows: unknown[], name = "records-0000.js") => Buffer.from(`window.PORTABLE_RECORD_SHARDS=window.PORTABLE_RECORD_SHARDS||{};window.PORTABLE_RECORD_SHARDS[${JSON.stringify(name)}]=${JSON.stringify(rows)};`);
const record = (id: string, type = "跑批结果") => ({ id, type, status: "success", model: "private-model", prompt: "输入", output: "输出" });

async function fixture(groups: unknown[][] = [[record("same")], [record("same", "Judge 结果")]]) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "eval-archive-test-")));
  roots.push(root);
  await mkdir(path.join(root, "data/records"), { recursive: true });
  const recordShards = [];
  for (let index = 0; index < groups.length; index++) {
    const rows = groups[index];
    const file = `records-${String(index).padStart(4, "0")}.js`;
    const bytes = wrap(rows, file);
    await writeFile(path.join(root, "data/records", file), bytes);
    recordShards.push({ file, count: rows.length, bytes: bytes.length });
  }
  const manifest = { recordShards, recordCounts: { staleTotal: 999 } };
  await writeFile(path.join(root, "data/manifest.json"), JSON.stringify(manifest));
  const config = path.join(root, "source.json");
  await writeFile(config, JSON.stringify({ root, provenance: "synthetic" }));
  return { root, config, manifest, shard: path.join(root, "data/records/records-0000.js") };
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("bounded read-only archive source", () => {
  it("translates allowlisted historical failures without echoing arbitrary source text", () => {
    expect(["timeout", "rate_limit", "pending", "auth_error"].map(archiveStatus)).toEqual(["历史超时", "历史限流", "历史待处理", "历史鉴权失败"]);
    for (const value of ["未知", "private text", "__proto__", "toString", null, {}]) expect(archiveStatus(value)).toBe("未分类状态");
  });
  it("audits actual records rather than stale counts and keeps duplicate IDs distinct", async () => {
    const f = await fixture();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const reader = await LocalArchiveReader.create(f.root, "synthetic");
    expect(reader.summary()).toBe(reader.summary());
    expect(await reader.summary()).toMatchObject({ totalRecords: 2, uniqueRecordIds: 1, shardCount: 2, manifestCountDelta: 997,
      counts: { "跑批结果": 1, "Judge 结果": 1, "Judge 任务": 0, "失败记录": 0, "其他": 0 } });
    expect((await reader.page(0, 1)).rows[0].key).not.toBe((await reader.page(1, 1)).rows[0].key);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("pages at 50, filters only a shard, keeps offsets and handles empty matches", async () => {
    const f = await fixture([Array.from({ length: 72 }, (_, i) => record(String(i), i % 2 ? "失败记录" : "跑批结果"))]);
    const reader = await LocalArchiveReader.create(f.root, "synthetic");
    expect((await reader.page(0, 1)).rows).toHaveLength(50);
    const second = await reader.page(0, 2);
    expect(second.rows).toHaveLength(22);
    expect(second.rows[0].offset).toBe(50);
    const filtered = await reader.page(0, 1, "失败记录");
    expect(filtered.matchingInShard).toBe(36);
    expect(filtered.rows[0].offset).toBe(1);
    expect((await reader.page(0, 1, "其他")).rows).toEqual([]);
    for (const [shard, page] of [[0, 3], [0, 0], [-1, 1], [2, 1], [0, 1.5]]) {
      await expect(reader.page(shard, page)).rejects.toMatchObject({ status: 400 });
    }
  });

  it("returns only presentation metadata and bounded redacted selected content", async () => {
    const token = ["sk", "syntheticOnlyNotARealCredential"].join("-");
    const f = await fixture([[{ ...record("private-id"), prompt: token + " ".repeat(10) + "x".repeat(6500), output: "", reason: "<script>not executed</script>",
      evidenceHash: "b".repeat(64), lineNo: 7, images: ["https://invalid.example/image"], source: "/private/source" }]]);
    const reader = await LocalArchiveReader.create(f.root, "synthetic");
    const page = await reader.page(0, 1);
    expect(JSON.stringify(page)).not.toMatch(/private-model|private-id|source|invalid\.example|script|syntheticOnly/);
    expect(page.rows[0]).toMatchObject({ hasPrompt: true, hasOutput: false, hasEvidence: true, imageCount: 1 });
    const content = await reader.content(0, 0);
    expect(content).toMatchObject({ truncated: true, output: null, evidence: { hash: "b".repeat(64), line: 7 } });
    expect(content.prompt).toHaveLength(6000);
    expect(content.prompt).toContain("[REDACTED]");
    expect(content.prompt).not.toContain(token);
    expect(content.reason).toBe("<script>not executed</script>");
    expect(await readFile(f.shard, "utf8")).toContain(token);
    await expect(reader.content(0, -1)).rejects.toMatchObject({ status: 400 });
  });

  it("never evaluates a JS wrapper, appended code, or malformed row", () => {
    expect(parseArchiveShard(wrap([record("x")]), "records-0000.js")).toHaveLength(1);
    for (const value of [Buffer.from("globalThis.compromised=true;"), Buffer.concat([wrap([]), Buffer.from("alert(1);")]),
      wrap([{ type: "跑批结果" }]), wrap(Array.from({ length: 301 }, () => record("x"))), Buffer.alloc(1024 * 1024 + 1)]) {
      expect(() => parseArchiveShard(value, "records-0000.js")).toThrow();
    }
    expect(() => parseArchiveShard(wrap([]), "../records-0000.js")).toThrow();
  });

  it("rejects traversal, duplicate descriptors, excessive manifest sizes and count mismatch", async () => {
    const f = await fixture();
    for (const recordShards of [[{ ...f.manifest.recordShards[0], file: "../secret" }],
      [f.manifest.recordShards[0], f.manifest.recordShards[0]], [{ ...f.manifest.recordShards[0], count: 301 }],
      [{ ...f.manifest.recordShards[0], bytes: 1024 * 1024 + 1 }]]) {
      await writeFile(path.join(f.root, "data/manifest.json"), JSON.stringify({ recordShards }));
      await expect(LocalArchiveReader.create(f.root, "synthetic")).rejects.toThrow();
    }
    f.manifest.recordShards[0].count = 2;
    await writeFile(path.join(f.root, "data/manifest.json"), JSON.stringify(f.manifest));
    await expect((await LocalArchiveReader.create(f.root, "synthetic")).summary()).rejects.toThrow();
  });

  it("rejects links and oversize regular files without following data outside the root", async () => {
    const f = await fixture();
    const linked = path.join(f.root, "linked.js");
    await symlink(f.shard, linked);
    await expect(readArchiveFile(linked)).rejects.toThrow();
    await writeFile(f.shard, Buffer.alloc(1024 * 1024 + 1));
    await expect(readArchiveFile(f.shard)).rejects.toMatchObject({ status: 413 });
  });

  it("detects equal-sized source changes and does not mix a new row with old statistics", async () => {
    const f = await fixture([[record("first")]]);
    const reader = await LocalArchiveReader.create(f.root, "synthetic");
    await reader.summary();
    await writeFile(f.shard, wrap([record("other")]));
    await expect(reader.page(0, 1)).rejects.toMatchObject({ code: "ARCHIVE_CHANGED", status: 409 });
  });
});

const request = (query = "", headers: Record<string, string> = {}) => new Request(`http://127.0.0.1:3100/api/local-archive${query}`, {
  headers: { "x-eval-archive": "local-read", ...headers },
});

describe("local archive route boundary", () => {
  it("blocks remote hosts, cross-site origins, rebinding hosts and missing custom headers", () => {
    for (const req of [new Request("http://evil.example/api/local-archive", { headers: { "x-eval-archive": "local-read" } }),
      new Request("http://127.0.0.1/api/local-archive"), request("", { origin: "https://evil.example" }),
      request("", { host: "evil.example" }), request("", { "sec-fetch-site": "cross-site" }), request("", { "sec-fetch-site": "same-site" })]) {
      expect(() => assertLocalArchiveRequest(req)).toThrow("本机");
    }
    expect(() => assertLocalArchiveRequest(request("", { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100", "sec-fetch-site": "same-origin" }))).not.toThrow();
    expect(() => assertLocalArchiveRequest(new Request("http://localhost:3100/api/local-archive", { headers: {
      "x-eval-archive": "local-read", host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", "sec-fetch-site": "same-origin",
    } }))).not.toThrow();
    for (const host of ["127.0.0.1:3101", "localhost:3100@evil.example", "localhost:3100/path"]) {
      expect(() => assertLocalArchiveRequest(request("", { host }))).toThrow();
    }
  });

  it("rejects unknown/duplicate/path/numeric parameters and content without confirmation", async () => {
    for (const query of ["?path=/private/file", "?shard=0&shard=1", "?action=write", "?page=-1", "?shard=NaN", "?type=arbitrary"]) {
      await expect(readArchiveRequest(request(query))).rejects.toMatchObject({ status: 400 });
    }
    const result = await GET(request("?action=content"));
    expect(result.status).toBe(403);
    expect(await result.json()).toMatchObject({ code: "CONTENT_CONFIRMATION" });
  });

  it("uses the real route and fixture, no-store responses, and no raw filesystem errors", async () => {
    const f = await fixture();
    vi.stubEnv("EVAL_ARCHIVE_CONFIG", f.config);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ok: true, data: { totalRecords: 2, provenance: "synthetic" } });
    const content = await GET(request("?action=content", { "x-eval-confirm-content": "1" }));
    expect(await content.json()).toMatchObject({ ok: true, data: { prompt: "输入" } });
    await writeFile(f.config, JSON.stringify({ root: path.join(f.root, "nonexistent"), provenance: "synthetic" }));
    const missing = await GET(request());
    expect(missing.status).toBe(503);
    expect(await missing.text()).not.toMatch(/ENOENT|eval-archive-test|nonexistent/);
    vi.stubEnv("EVAL_ARCHIVE_CONFIG", path.join(f.root, "no-config"));
    expect(await (await GET(request())).json()).toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
