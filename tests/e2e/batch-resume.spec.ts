import { expect, test } from "@playwright/test";

test("persists a paused batch and resumes only unfinished calls after reload", async ({
  page,
}) => {
  const requestCounts = new Map<string, number>();
  const browserErrors: string[] = [];
  let slowUnfinishedCalls = true;

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/run-custom") {
      await route.fulfill({
        body: JSON.stringify({ error: "E2E blocks unrelated API calls" }),
        contentType: "application/json",
        status: 503,
      });
      return;
    }

    const body = route.request().postDataJSON() as { prompt: string };
    const prompt = body.prompt;
    const callCount = (requestCounts.get(prompt) ?? 0) + 1;
    requestCounts.set(prompt, callCount);
    const inputNumber = Number(prompt.replace("批量用例 ", ""));

    if (slowUnfinishedCalls && inputNumber > 3) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    await route.fulfill({
      body: JSON.stringify({
        outputText: `结果：${prompt}`,
        outputImages: [],
        latencyMs: 20,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("tablist", { name: "工作区功能导航" })
  ).toBeVisible();
  await page.getByRole("button", { name: "批量导入" }).click();

  const inputSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "输入数据" }) });
  for (let index = 0; index < 12; index += 1) {
    await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
  }

  const rows = inputSection.locator("tbody tr");
  await expect(rows).toHaveCount(12);
  for (let index = 0; index < 12; index += 1) {
    await rows.nth(index).locator("input").first().fill(`批量用例 ${index + 1}`);
  }

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByLabel("并发").fill("1");
  await page.getByRole("button", { name: "批量运行", exact: true }).click();

  const progress = page.getByRole("progressbar", { name: "批量任务进度" });
  await expect(page.getByText("运行中…", { exact: true })).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "3");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.getByText("发现可继续的批量任务")).toBeVisible();
  await expect(page.getByText(/继续后只执行剩余单元/)).toBeVisible();
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();

  slowUnfinishedCalls = false;
  await page.reload();
  await expect(
    page.getByRole("tablist", { name: "工作区功能导航" })
  ).toBeVisible();
  await expect(page.getByText("发现可继续的批量任务")).toBeVisible();
  await page.getByRole("button", { name: "继续剩余任务" }).click();

  await expect(page.getByText("发现可继续的批量任务")).toBeHidden();
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await expect(page.getByRole("heading", { name: "历史任务（1）" })).toBeVisible();
  await expect(page.getByText("12 / 12 调用", { exact: true })).toBeVisible();
  await expect(page.getByText("完成", { exact: true })).toBeVisible();

  for (let index = 1; index <= 3; index += 1) {
    expect(requestCounts.get(`批量用例 ${index}`)).toBe(1);
  }
  expect(browserErrors).toEqual([]);
});

test("terminates a running batch without leaving a resumable task", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({
      body: JSON.stringify({
        outputText: "mock result",
        outputImages: [],
        latencyMs: 200,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("tablist", { name: "工作区功能导航" })
  ).toBeVisible();
  await page.getByRole("button", { name: "批量导入" }).click();

  const inputSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "输入数据" }) });
  for (let index = 0; index < 4; index += 1) {
    await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
  }
  const rows = inputSection.locator("tbody tr");
  for (let index = 0; index < 4; index += 1) {
    await rows.nth(index).locator("input").first().fill(`终止用例 ${index + 1}`);
  }

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByLabel("并发").fill("1");
  await page.getByRole("button", { name: "批量运行", exact: true }).click();
  await expect(
    page.getByRole("progressbar", { name: "批量任务进度" })
  ).toBeVisible();
  await page.getByRole("button", { name: "终止", exact: true }).click();

  await expect(page.getByText("发现可继续的批量任务")).toBeHidden();
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await expect(page.getByText("已取消", { exact: true })).toBeVisible();
});
