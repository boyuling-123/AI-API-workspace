import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { test, expect } from "./fixtures";

test("Chinese lab records recovery, exports actual spans, and stays offline", async ({ page, safePage }) => {
  const outbound: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
      outbound.push(url.origin);
      await route.abort();
    } else await route.fallback();
  });
  await page.goto("/observability");
  await expect(page.getByRole("heading", { level: 1, name: "Agent 观测实验室" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下载实验 JSON" })).toBeDisabled();
  await page.getByRole("button", { name: "运行 3 组本地实验" }).click();
  await expect(page.getByRole("status")).toContainText("采集完成");
  await expect(page.getByRole("row")).toHaveCount(4);
  const retry = page.getByRole("row").filter({ has: page.getByRole("button", { name: "查看失败重试调用链" }) });
  await expect(retry.getByRole("cell").nth(1)).toHaveText("成功");
  await expect(retry.getByRole("cell").nth(4)).toHaveText("1");
  await retry.getByRole("button").click();
  await expect(page.getByText("库存查询：首次失败（故障注入）", { exact: true })).toBeVisible();
  await expect(page.getByText("库存查询：重试恢复（本地桩）", { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载实验 JSON" }).click();
  const download = await downloadEvent;
  const result = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(result.source).toBe("local-mock-otel");
  expect(result.spans).toHaveLength(14);
  expect(result.tokens).toBeNull();
  expect(result.modelCost).toBeNull();
  expect(result.modelCalls).toBe(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: "docs/evidence/pr-agent-observability/agent-lab.png", fullPage: true });
  }
  expect(outbound).toEqual([]);
  expect(safePage.apiRequests).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name: "下载实验 JSON" })).toBeDisabled();
});

test("lab is reachable from overview and fits a narrow viewport", async ({ page, safePage }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?tab=overview");
  await page.getByRole("link", { name: "打开观测实验室（Mock）" }).click();
  await page.getByRole("button", { name: "运行 3 组本地实验" }).click();
  await expect(page.getByRole("status")).toContainText("采集完成");
  await page.getByRole("button", { name: "查看并行协作调用链" }).click();
  await expect(page.getByText("规则检查 Agent（模拟）", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(safePage.browserErrors).toEqual([]);
});
