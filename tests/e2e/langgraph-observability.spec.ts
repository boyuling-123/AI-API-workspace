import { expect, test as base } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const test = base.extend<{ networkGuard: void }>({
  networkGuard: [async ({ page }, use) => {
    const unexpected: string[] = [], errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!["localhost", "127.0.0.1"].includes(url.hostname) || (url.pathname.startsWith("/api/") && url.pathname !== "/api/experiments/langgraph")) {
        unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort();
      } else await route.fallback();
    });
    await use();
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

test.describe.configure({ mode: "serial" });

test("real LangGraph callbacks produce Chinese recovery details and portable JSON on explicit click", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/experiments/")) calls.push(request.method()); });
  await page.goto("/observability");
  await expect(page.getByRole("heading", { level: 1, name: "Agent 观测实验室" })).toBeVisible();
  expect(calls).toEqual([]);
  await page.getByRole("button", { name: "运行 LangGraph 实验", exact: true }).click();
  await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
  await expect(page.getByLabel("当前结果来源")).toContainText("LangGraph 真实调度");
  await expect(page.getByRole("row")).toHaveCount(3);
  await page.getByRole("button", { name: "查看失败重试调用链" }).click();
  await page.getByRole("button", { name: "检查步骤：库存工具（Mock，第 1 次）", exact: true }).click();
  await expect(page.getByRole("region", { name: "选中步骤详情" })).toContainText("异常");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载实验 JSON" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("agent-observability-langgraph-mock.json");
  const result = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(result.source).toBe("local-langgraph-mock-otel");
  expect(result.framework.execution).toBe("StateGraph");
  expect(result.spans).toHaveLength(7);
  expect(result.modelCalls).toBe(0);
  expect(result.tokens).toBeNull();
  expect(result.modelCost).toBeNull();
  expect(calls).toEqual(["POST"]);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  if (process.env.LANGGRAPH_EVIDENCE_PATH) {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: process.env.LANGGRAPH_EVIDENCE_PATH, fullPage: true, animations: "disabled" });
  }
});

test("failure and stop preserve earlier results, retry succeeds, and narrow layout stays accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/observability");
  await page.getByRole("button", { name: "运行 3 组本地实验" }).click();
  await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
  await page.route("**/api/experiments/langgraph", (route) => route.fulfill({ status: 503, body: "synthetic-private-server-error" }));
  await page.getByRole("button", { name: "运行 LangGraph 实验", exact: true }).click();
  await expect(page.getByRole("alert", { name: "实验运行错误" })).toContainText("暂不可用");
  await expect(page.getByRole("row")).toHaveCount(4);
  await expect(page.locator("body")).not.toContainText("synthetic-private-server-error");
  await page.unroute("**/api/experiments/langgraph");
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/experiments/langgraph", async (route) => { await held; await route.abort().catch(() => undefined); });
  try {
    await page.getByRole("button", { name: "运行 LangGraph 实验", exact: true }).click();
    await expect(page.getByRole("button", { name: "运行 LangGraph 实验", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "停止本地实验", exact: true }).click();
    await expect(page.getByRole("alert", { name: "实验运行错误" })).toContainText("已停止");
    await expect(page.getByRole("row")).toHaveCount(4);
  } finally { release(); }
  await page.unroute("**/api/experiments/langgraph");
  const run = page.getByRole("button", { name: "运行 LangGraph 实验", exact: true });
  await run.focus(); await page.keyboard.press("Enter");
  await expect(page.getByLabel("当前结果来源")).toContainText("LangGraph 真实调度");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});

test("real endpoint rejects cross-origin requests and data payloads", async ({ request }) => {
  const endpoint = "/api/experiments/langgraph", headers = { "x-eval-experiment": "langgraph-mock" };
  expect((await request.post(endpoint)).status()).toBe(403);
  expect((await request.post(endpoint, { headers: { ...headers, origin: "https://example.invalid" } })).status()).toBe(403);
  expect((await request.post(endpoint, { headers, data: { prompt: "synthetic" } })).status()).toBe(400);
  expect((await request.post(`${endpoint}?input=synthetic`, { headers })).status()).toBe(400);
  expect((await request.get(endpoint, { headers })).status()).toBe(405);
});
