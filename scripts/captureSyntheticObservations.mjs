import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseURL = "http://127.0.0.1:3002";
const startedAt = new Date().toISOString();
const output = path.join("local-data", `synthetic-observations-${startedAt.replace(/[:.]/g, "-")}`);
await mkdir(output, { recursive: true });
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const browser = await chromium.launch({ headless: true });
const captures = [];

async function download(page, filename) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载实验 JSON", exact: true }).click();
  const result = await pending;
  assert.equal(await result.failure(), null);
  const destination = path.join(output, filename);
  await result.saveAs(destination);
  const bytes = await readFile(destination);
  assert(bytes.length <= 64 * 1024, "Observation exceeds current import limit");
  return { destination, bytes, data: JSON.parse(bytes.toString("utf8")) };
}

try {
  for (const mode of ["manual", "langgraph"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const unexpected = [], pageErrors = [], apiCalls = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      const api = url.pathname.startsWith("/api/");
      if (api) apiCalls.push(`${route.request().method()} ${url.pathname}`);
      const allowed = url.origin === baseURL && (!api || (mode === "langgraph" && url.pathname === "/api/experiments/langgraph" && route.request().method() === "POST"));
      if (!allowed) { unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`); await route.abort(); }
      else await route.continue();
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    try {
      await page.goto(`${baseURL}/observability`);
      await expect(page.getByRole("button", { name: "下载实验 JSON", exact: true })).toBeDisabled();
      assert.deepEqual(apiCalls, []);
      await page.getByRole("button", { name: mode === "manual" ? "运行 3 组本地实验" : "运行 LangGraph 实验", exact: true }).click();
      await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
      const original = await download(page, `${mode}-observations.json`);
      assert.equal(original.data.source, mode === "manual" ? "local-mock-otel" : "local-langgraph-mock-otel");
      assert.equal(original.data.modelCalls, 0);
      assert.equal(original.data.tokens, null);
      assert.equal(original.data.modelCost, null);
      assert.equal(original.data.spans.length, mode === "manual" ? 14 : 7);
      assert.equal(original.data.spans.filter(span => !span.parentSpanId).length, mode === "manual" ? 3 : 2);
      assert(!Object.hasOwn(original.data, "provenance"));
      const tableRows = [];
      // Accessible data rows exclude Ant Design's hidden column-measurement row.
      for (const row of await page.getByRole("table").getByRole("row").filter({ has: page.getByRole("button") }).all()) {
        tableRows.push(await row.getByRole("cell").allTextContents());
      }
      assert.equal(tableRows.length, mode === "manual" ? 3 : 2);
      await page.getByRole("button", { name: "查看失败重试调用链", exact: true }).click();
      await page.screenshot({ path: path.join(output, `${mode}-result.png`), fullPage: true, animations: "disabled" });
      await page.reload();
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "选择本机 JSON 文件", exact: true }).focus();
      await page.keyboard.press("Enter");
      await (await chooser).setFiles(original.destination);
      const preview = page.getByRole("region", { name: "观测文件预览" });
      await expect(preview).toContainText(mode === "manual" ? "3 条调用链 / 14 个步骤" : "2 条调用链 / 7 个步骤");
      await expect(preview).toContainText("来源未认证");
      await expect(page.getByRole("button", { name: "下载实验 JSON", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "取消回读，保留当前结果", exact: true }).click();
      await expect(preview).not.toBeVisible();
      await expect(page.getByRole("button", { name: "下载实验 JSON", exact: true })).toBeDisabled();
      await page.getByLabel("选择观测 JSON 文件", { exact: true }).setInputFiles(original.destination);
      await page.getByRole("button", { name: "确认加载观测文件", exact: true }).click();
      await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("文件已加载，未重新执行");
      await expect(page.getByLabel("当前结果来源")).toContainText("外部文件回读，来源未认证");
      const roundtrip = await download(page, `${mode}-reopened-unverified.json`);
      assert.deepEqual(roundtrip.data, { ...original.data, provenance: { kind: "local-file", verification: "unverified" } });
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      assert.deepEqual((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations, []);
      assert.deepEqual(apiCalls, mode === "manual" ? [] : ["POST /api/experiments/langgraph"]);
      assert.deepEqual(unexpected, []);
      assert.deepEqual(pageErrors, []);
      const files = [original, roundtrip].map(file => ({ name: path.basename(file.destination), bytes: file.bytes.length, sha256: createHash("sha256").update(file.bytes).digest("hex") }));
      captures.push({ mode, source: original.data.source, createdAt: original.data.createdAt, instrumentation: original.data.instrumentation,
        ...(original.data.framework ? { framework: original.data.framework } : {}), modelCalls: 0, tokens: null, modelCost: null,
        tableColumns: ["执行方式", "任务状态", "耗时/ms（页面显示值）", "工具调用", "异常步骤", "重试次数"],
        tableRows, apiCalls, blockedRequests: unexpected.length, pageErrors: pageErrors.length, confirmedRoundtrip: true, axeViolations: 0, files });
      await context.tracing.stop({ path: path.join(output, `${mode}-trace.zip`) });
    } finally { await context.close(); }
  }
  const manifest = { schemaVersion: 1, purpose: "synthetic-engineering-evidence-not-model-benchmark", startedAt,
    completedAt: new Date().toISOString(), sourceCommit, sourceTree: "runtime-unchanged-plus-capture-script-and-docs",
    runtime: { node: process.version }, historicalArchiveRead: false, modelCalls: 0, captures };
  await writeFile(path.join(output, "capture-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ output, manifest }, null, 2));
} finally { await browser.close(); }
