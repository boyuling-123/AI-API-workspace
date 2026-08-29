import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

interface RunCall {
  prompt: string;
  targetId: string;
}

async function prepareBatch(
  page: Page,
  prompts: string[]
): Promise<void> {
  await page.goto("/");
  await expect(
    page.getByRole("tablist", { name: "工作区功能导航" })
  ).toBeVisible();
  await page.getByRole("button", { name: "批量导入" }).click();

  const inputSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "输入数据" }) });
  for (const prompt of prompts) {
    await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
    await inputSection
      .locator("tbody tr")
      .last()
      .locator("input")
      .first()
      .fill(prompt);
  }

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: /Kimi K2.6/ }).click();
  await page.getByLabel("并发").fill("2");
  await page.getByRole("button", { name: "批量运行", exact: true }).click();
}

function historyRows(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /历史任务/ }) })
    .locator("li");
}

test("reruns only the exact failed Case and target pair", async ({ page }) => {
  const calls: RunCall[] = [];
  let sourceRun = true;

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    expect(pathname).toBe("/api/run-custom");
    const body = route.request().postDataJSON() as {
      prompt: string;
      target: { id: string };
    };
    calls.push({ prompt: body.prompt, targetId: body.target.id });

    if (
      sourceRun &&
      body.prompt === "Case 1" &&
      body.target.id === "deepseek-v4-pro"
    ) {
      await route.fulfill({
        body: JSON.stringify({
          error: "Mock 鉴权失败",
          errorType: "auth",
          retryable: false,
          httpStatus: 401,
        }),
        contentType: "application/json",
        status: 401,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({
        outputText: `Mock ${body.prompt}:${body.target.id}`,
        outputImages: [],
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await prepareBatch(page, ["Case 1", "Case 2"]);
  await expect.poll(() => calls.length).toBe(4);
  await expect(
    page.getByRole("button", { name: "批量运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "定向重跑" }).click();
  const dialog = page.getByRole("dialog", { name: "定向重跑" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("1 次调用", { exact: true })).toBeVisible();
  expect(calls).toHaveLength(4);

  sourceRun = false;
  await dialog.getByRole("button", { name: "确认并开始重跑" }).click();
  await expect.poll(() => calls.length).toBe(5);
  expect(calls[4]).toEqual({
    prompt: "Case 1",
    targetId: "deepseek-v4-pro",
  });

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await expect(page.getByRole("heading", { name: "历史任务（2）" })).toBeVisible();
  const rows = historyRows(page);
  await expect(rows.first()).toContainText("重跑·失败项");
  await expect(rows.first()).toContainText("1 / 1 调用");
  await expect(rows.first()).toContainText("完成");
  await expect(rows.nth(1)).toContainText("4 / 4 调用");
  expect(calls.every((call) => call.targetId !== "qwen3.6-plus")).toBe(true);
});

test("previews and reruns only selected Case ranges", async ({ page }) => {
  const calls: RunCall[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    expect(pathname).toBe("/api/run-custom");
    const body = route.request().postDataJSON() as {
      prompt: string;
      target: { id: string };
    };
    calls.push({ prompt: body.prompt, targetId: body.target.id });
    await route.fulfill({
      body: JSON.stringify({ outputText: "Mock success", outputImages: [] }),
      contentType: "application/json",
      status: 200,
    });
  });

  await prepareBatch(page, ["Case 1", "Case 2", "Case 3"]);
  await expect.poll(() => calls.length).toBe(6);
  await expect(
    page.getByRole("button", { name: "批量运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "定向重跑" }).click();
  const dialog = page.getByRole("dialog", { name: "定向重跑" });
  const caseInput = dialog.getByLabel("Case 序号");
  await expect(caseInput).toBeVisible();

  await caseInput.fill("4");
  await expect(dialog.getByText("“4”超出 1-3 的范围")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "确认并开始重跑" })
  ).toBeDisabled();
  expect(calls).toHaveLength(6);

  await caseInput.fill("2-3");
  await expect(dialog.getByText("4 次调用", { exact: true })).toBeVisible();
  await expect(dialog.getByText("2 个 Case · 2 个目标", { exact: false })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockingAccessibility = accessibility.violations
    .filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
    .map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    }));
  expect(blockingAccessibility).toEqual([]);
  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.screenshot({
      path: "docs/evidence/pr-03c/selective-rerun-preview.png",
      fullPage: true,
    });
  }

  await dialog.getByRole("button", { name: "确认并开始重跑" }).click();
  await expect.poll(() => calls.length).toBe(10);
  expect(
    calls
      .slice(6)
      .map((call) => `${call.prompt}:${call.targetId}`)
      .sort()
  ).toEqual(
    [
      "Case 2:deepseek-v4-pro",
      "Case 2:kimi-k2.6",
      "Case 3:deepseek-v4-pro",
      "Case 3:kimi-k2.6",
    ].sort()
  );

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await expect(historyRows(page).first()).toContainText("重跑·指定 Case");
  await expect(historyRows(page).first()).toContainText("4 / 4 调用");
});
