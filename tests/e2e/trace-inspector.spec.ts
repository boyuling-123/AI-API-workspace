import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("unexpected external request in local trace inspector");
    return route.fallback();
  });
});
async function collect(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "运行 3 组本地实验", exact: true }).click();
  await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
}

test("inspects failed and recovered steps using keyboard, preserves export and resets selection", async ({ page, safePage }) => {
  await page.goto("/observability");
  await expect(page.getByRole("heading", { name: "步骤时间与详情" })).toHaveCount(0);
  await collect(page);
  await page.getByRole("button", { name: "查看失败重试调用链" }).click();
  const list = page.getByRole("region", { name: "步骤时间列表" });
  const detail = page.getByRole("region", { name: "选中步骤详情" });
  await expect(list.getByRole("button")).toHaveCount(5);
  const failed = list.getByRole("button", { name: "检查步骤：库存查询：首次失败（故障注入）", exact: true });
  await failed.focus();
  await page.keyboard.press("Enter");
  await expect(failed).toHaveAttribute("aria-pressed", "true");
  await expect(detail.getByRole("heading")).toHaveText("库存查询：首次失败（故障注入）");
  await expect(detail).toContainText("这是步骤异常，不代表整个任务失败");
  await page.getByRole("button", { name: "检查下一步" }).click();
  await page.getByRole("button", { name: "检查下一步" }).click();
  await expect(detail.getByRole("heading")).toHaveText("库存查询：重试恢复（本地桩）");
  await expect(detail.locator("dd").nth(1)).toHaveText("成功");
  await expect(page.getByRole("button", { name: "检查下一步" })).toBeDisabled();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载实验 JSON" }).click();
  const result = JSON.parse(await readFile((await (await downloadEvent).path())!, "utf8"));
  expect(result.spans).toHaveLength(14);
  expect(result.spans.filter((s: { status: string }) => s.status === "error")).toHaveLength(1);
  expect(result).toMatchObject({ source: "local-mock-otel", modelCalls: 0, tokens: null, modelCost: null });
  await expect(page.getByText("时间轴复用 Langfuse", { exact: false })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  if (process.env.TRACE_INSPECTOR_EVIDENCE) {
    await failed.click();
    await expect(page.getByRole("button", { name: "检查下一步" })).toBeEnabled();
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.screenshot({ path: process.env.TRACE_INSPECTOR_EVIDENCE, fullPage: true, animations: "disabled" });
  }
  await collect(page);
  await expect(detail.getByRole("heading")).toHaveText("顺序工作流");
  await expect(page.getByRole("button", { name: "检查上一步" })).toBeDisabled();
  expect(safePage.apiRequests).toEqual([]);
  expect(safePage.browserErrors).toEqual([]);
});

test("parallel hierarchy and narrow layout remain readable without overflow", async ({ page, safePage }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/observability");
  await collect(page);
  await page.getByRole("button", { name: "查看并行协作调用链" }).click();
  const list = page.getByRole("region", { name: "步骤时间列表" });
  await expect(list.getByRole("button")).toHaveCount(6);
  await list.getByRole("button", { name: "检查步骤：读取库存（本地桩）", exact: true }).click();
  const detail = page.getByRole("region", { name: "选中步骤详情" });
  await expect(detail.locator("dd").nth(4)).toHaveText("2");
  await expect(detail.locator("dd").nth(5)).toHaveText("库存检查 Agent（模拟）");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(safePage.apiRequests).toEqual([]);
  expect(safePage.browserErrors).toEqual([]);
});
