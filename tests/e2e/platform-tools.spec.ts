import { expect, test as base } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const test = base.extend<{ toolsGuard: void }>({
  toolsGuard: [async ({ page }, use) => {
    const unexpected: string[] = [], errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!["localhost", "127.0.0.1"].includes(url.hostname) || (url.pathname.startsWith("/api/") && url.pathname !== "/api/platform-actions")) {
        unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort();
      } else await route.fallback();
    });
    await use();
    expect(unexpected, "no model, raw content or unrelated API calls").toEqual([]);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

test("Chinese tools page calls real actions only on click and exposes safe archive aggregates", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/platform-actions")) calls.push(request.url()); });
  await page.goto("/assistant-tools");
  await expect(page.getByRole("heading", { name: "平台助手工具", level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("尚未调用");
  expect(calls).toEqual([]);
  await page.getByRole("button", { name: "查询平台能力", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("调用完成");
  await expect(page.getByText("已开放 2 项工具", { exact: false })).toBeVisible();
  expect(calls).toHaveLength(1);
  await page.getByRole("button", { name: "读取归档统计", exact: true }).click();
  await expect(page.getByText("合成测试夹具，不是真实评测。")).toBeVisible();
  await expect(page.locator("dd")).toHaveText(["63", "62", "2"]);
  expect(calls).toHaveLength(2);
  await expect(page.locator("body")).not.toContainText("synthetic-private-model");
  await expect(page.locator("body")).not.toContainText("合成输入");
  await expect(page.getByText("暂未开放", { exact: true })).toBeVisible();
  await page.getByText("查看结构化返回（不含正文）", { exact: true }).click();
  await expect(page.locator("pre")).toContainText('"modelCalls": 0');
  await expect(page.locator("pre")).not.toContainText('"prompt"');
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  if (process.env.ACTION_EVIDENCE_PATH) {
    await page.getByText("查看结构化返回（不含正文）", { exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.screenshot({ path: process.env.ACTION_EVIDENCE_PATH, fullPage: true });
  }
});

test("unavailable tool has Chinese error, clears stale results and recovers without exposing errors", async ({ page }) => {
  await page.goto("/assistant-tools");
  await page.getByRole("button", { name: "查询平台能力", exact: true }).click();
  await expect(page.getByText("已开放 2 项工具", { exact: false })).toBeVisible();
  let releaseFailure!: () => void;
  const pendingFailure = new Promise<void>((resolve) => { releaseFailure = resolve; });
  await page.route("**/api/platform-actions?action=get_archive_summary", async (route) => {
    await pendingFailure;
    await route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "NOT_CONFIGURED", error: "synthetic-private-server-path" }),
    });
  });
  const retryButton = page.getByRole("button", { name: "读取归档统计", exact: true });
  try {
    await retryButton.click();
    await expect(retryButton).toHaveAttribute("aria-busy", "true");
    await expect(retryButton).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("正在执行只读查询");
  } finally { releaseFailure(); }
  await expect(page.getByRole("alert", { name: "工具调用错误" })).toContainText("尚未配置本地历史归档");
  await expect(retryButton).toHaveAttribute("aria-busy", "false");
  await expect(retryButton).toBeEnabled();
  await expect(page.getByText("已开放 2 项工具", { exact: false })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("synthetic-private-server-path");
  await page.unroute("**/api/platform-actions?action=get_archive_summary");
  await retryButton.click();
  await expect(page.locator("dd")).toHaveText(["63", "62", "2"]);
  await expect(page.getByRole("alert", { name: "工具调用错误" })).toHaveCount(0);
});

test("entry link, mobile, keyboard and read-only API restrictions remain usable", async ({ page, request }) => {
  await page.goto("/?tab=overview");
  await page.getByRole("link", { name: "打开助手工具（只读 MCP）", exact: true }).click();
  await expect(page.getByRole("heading", { name: "平台助手工具", level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const button = page.getByRole("button", { name: "查询平台能力", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("调用完成");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  const endpoint = "/api/platform-actions?action=get_platform_capabilities";
  expect((await request.get(endpoint)).status()).toBe(403);
  expect((await request.get(endpoint, { headers: { "x-eval-archive": "local-read", origin: "https://invalid.example" } })).status()).toBe(403);
  expect((await request.get("/api/platform-actions?action=delete_project", { headers: { "x-eval-archive": "local-read" } })).status()).toBe(400);
  expect((await request.post(endpoint, { data: {} })).status()).toBe(405);
});
