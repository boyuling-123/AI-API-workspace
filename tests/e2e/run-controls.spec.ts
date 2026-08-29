import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function prepareSingleBatch(page: Page, prompt: string) {
  await page.goto("/");
  await expect(
    page.getByRole("tablist", { name: "工作区功能导航" })
  ).toBeVisible();
  await page.getByRole("button", { name: "批量导入" }).click();

  const inputSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "输入数据" }) });
  await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
  await inputSection.locator("tbody tr").first().locator("input").first().fill(prompt);

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByText("高级运行策略", { exact: true }).click();
  await page.getByLabel("QPS 上限").fill("0");
  await page.getByLabel("单次超时（秒）").fill("1");
}

test("persists a run policy and shows a successful finite retry", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const requestBodies: Array<{ timeoutMs?: number }> = [];
  let callCount = 0;
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.route("**/api/**", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/run-custom") {
      await route.fulfill({ status: 503, body: "blocked unrelated API" });
      return;
    }
    callCount += 1;
    requestBodies.push(route.request().postDataJSON() as { timeoutMs?: number });
    if (callCount === 1) {
      await route.fulfill({
        body: JSON.stringify({
          error: "请求过快",
          errorType: "rate_limit",
          retryable: true,
          httpStatus: 429,
        }),
        contentType: "application/json",
        status: 429,
      });
      return;
    }
    await route.fulfill({
      body: JSON.stringify({
        outputText: "重试后的 Mock 结果",
        outputImages: [],
        latencyMs: 10,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await prepareSingleBatch(page, "需要重试的用例");
  await page.getByLabel("并发").fill("2");
  await page.getByLabel("失败重试次数").fill("1");
  await page.getByRole("button", { name: "运行", exact: true }).click();

  await expect.poll(() => callCount).toBe(2);
  await expect(
    page.getByRole("button", { name: "运行", exact: true })
  ).toBeEnabled();
  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await expect(
    page.getByText("并发 2 · QPS 不限速 · 超时 1s · 重试 1", {
      exact: true,
    })
  ).toBeVisible();
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByText("重试后的 Mock 结果")).toBeVisible();
  await expect(
    page.getByText("自动重试后成功，共尝试 2 次", { exact: true })
  ).toBeVisible();

  expect(requestBodies).toHaveLength(2);
  expect(requestBodies.every((body) => body.timeoutMs === 1_000)).toBe(true);
  expect(
    browserErrors.every((message) => message.includes("status of 429"))
  ).toBe(true);
});

test("classifies an auth failure and never retries it", async ({ page }) => {
  let callCount = 0;
  await page.route("**/api/**", async (route) => {
    callCount += 1;
    await route.fulfill({
      body: JSON.stringify({
        error: "测试 Key 无效",
        errorType: "auth",
        retryable: false,
        httpStatus: 401,
      }),
      contentType: "application/json",
      status: 401,
    });
  });

  await prepareSingleBatch(page, "鉴权失败用例");
  await page.getByLabel("失败重试次数").fill("3");
  await page.getByRole("button", { name: "运行", exact: true }).click();

  await expect(
    page.getByRole("button", { name: "运行", exact: true })
  ).toBeEnabled();
  expect(callCount).toBe(1);
  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(
    page.getByRole("table").getByText("鉴权失败", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("已尝试 1 次", { exact: true })).toBeVisible();
  await expect(page.getByText("HTTP 401", { exact: true })).toBeVisible();
  await page.getByLabel("结果筛选").selectOption("success");
  await expect(page.getByText("当前筛选条件下没有结果。")).toBeVisible();
  await page.getByLabel("结果筛选").selectOption("auth");
  await expect(
    page.getByRole("table").getByText("鉴权失败", { exact: true })
  ).toBeVisible();
});
