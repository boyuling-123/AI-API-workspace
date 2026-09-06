import { afterEach, describe, expect, it } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { ACTION_ERRORS, ACTION_LIMITS, PLATFORM_ACTION_NAMES } from "@/lib/platformActions";
import { actionArchiveFixture } from "../helpers/actionArchiveFixture";

const roots: string[] = [];
const clients: Client[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.close();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function connect(config: string, modern = false) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve(".mcp-dist/mcp/stdio.js")],
    cwd: tmpdir(), env: { EVAL_ARCHIVE_CONFIG: config }, stderr: "pipe" });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  const client = new Client({ name: "synthetic-test-client", version: "1.0.0" },
    modern ? { versionNegotiation: { mode: { pin: "2026-07-28" } } } : {});
  clients.push(client);
  await client.connect(transport);
  return { client, stderr: () => stderr };
}

describe("official MCP client to compiled real stdio server", () => {
  for (const modern of [false, true]) it(`connects, lists and calls safe tools (${modern ? "2026 pinned" : "2025 legacy handshake"})`, async () => {
    const f = await actionArchiveFixture(); roots.push(f.root);
    const { client, stderr } = await connect(f.config, modern);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(PLATFORM_ACTION_NAMES);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true && tool.annotations.destructiveHint === false)).toBe(true);
    expect(tools.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true);
    const capabilities = await client.callTool({ name: "get_platform_capabilities", arguments: {} });
    expect(capabilities.isError).not.toBe(true);
    expect(capabilities.structuredContent).toMatchObject({ action: "get_platform_capabilities", modelCalls: 0, limits: ACTION_LIMITS });
    expect(JSON.stringify(capabilities.structuredContent)).toContain("真实 LangGraph 调度固定 Mock 节点");
    expect(JSON.stringify(capabilities.structuredContent)).toContain("不代表任意用户 Agent 或框架已兼容");
    expect(JSON.stringify(capabilities.structuredContent)).toContain("来源未认证，不证明现场执行，也不会重放 Agent");
    expect(capabilities.content).toEqual([{ type: "text", text: JSON.stringify(capabilities.structuredContent) }]);
    const archive = await client.callTool({ name: "get_archive_summary", arguments: {} });
    expect(archive.isError).not.toBe(true);
    expect(archive.structuredContent).toMatchObject({ action: "get_archive_summary", summary: { totalRecords: 2, uniqueRecordIds: 1, provenance: "synthetic" } });
    expect(JSON.stringify(archive)).not.toMatch(/private-|synthetic-id|eval-action-fixture/);
    expect(await readFile(f.shard)).toEqual(f.bytes);
    expect(stderr()).toBe("");
  }, 15000);

  it("rejects unknown tools and unexpected arguments without exposing supplied values", async () => {
    const f = await actionArchiveFixture(); roots.push(f.root);
    const { client, stderr } = await connect(f.config);
    await expect(client.callTool({ name: "delete_project", arguments: {} })).rejects.toThrow();
    const invalid = await client.callTool({ name: "get_archive_summary", arguments: { path: "synthetic-private-file" } }).catch((error: Error) => ({ isError: true, message: error.message }));
    expect(invalid.isError).toBe(true);
    expect(JSON.stringify(invalid)).not.toContain("synthetic-private-file");
    expect(await readFile(f.shard)).toEqual(f.bytes);
    expect(stderr()).not.toContain("synthetic-private-file");
  }, 15000);

  it("reports missing archive safely and can still discover tools", async () => {
    const f = await actionArchiveFixture(); roots.push(f.root);
    const { client, stderr } = await connect(`${f.root}/missing-private-config.json`);
    const result = await client.callTool({ name: "get_archive_summary", arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: ACTION_ERRORS.NOT_CONFIGURED }]);
    expect(JSON.stringify(result)).not.toContain(f.root);
    expect((await client.listTools()).tools).toHaveLength(2);
    expect(stderr()).toBe("");
  }, 15000);
});
