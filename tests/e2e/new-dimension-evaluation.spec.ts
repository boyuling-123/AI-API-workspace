import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

interface EvaluateCall {
  item: {
    inputId: string;
    targets: { targetId: string; targetName: string }[];
  };
  dimensions: {
    name: string;
    desc?: string;
    scoreLevels?: { score: number; criteria: string }[];
    evidenceRequirements?: string[];
    judgeInstruction?: string;
  }[];
}

async function prepareSourceEvaluation(page: Page): Promise<{
  runCalls: string[];
  evaluateCalls: EvaluateCall[];
}> {
  const runCalls: string[] = [];
  const evaluateCalls: EvaluateCall[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      const body = route.request().postDataJSON() as {
        prompt: string;
        target: { id: string };
      };
      runCalls.push(`${body.prompt}:${body.target.id}`);
      await route.fulfill({
        body: JSON.stringify({
          outputText: `Mock output for ${body.prompt}`,
          outputImages: [],
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (pathname === "/api/evaluate") {
      const body = route.request().postDataJSON() as EvaluateCall;
      evaluateCalls.push(body);
      await route.fulfill({
        body: JSON.stringify({
          inputId: body.item.inputId,
          scores: body.item.targets.map((target) => ({
            targetId: target.targetId,
            targetName: target.targetName,
            dimensionScores: body.dimensions.map((dimension) => ({
              dimension: dimension.name,
              score: 8,
              comment: `Mock ${dimension.name}`,
            })),
            overallComment: "Mock overall comment",
          })),
          summary: "Mock summary",
          recommendation: "Mock recommendation",
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({ error: `Unexpected E2E route: ${pathname}` }),
      contentType: "application/json",
      status: 500,
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
  await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
  await inputSection
    .locator("tbody tr")
    .last()
    .locator("input")
    .first()
    .fill("Case 1");

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect.poll(() => runCalls.length).toBe(1);
  await expect(
    page.getByRole("button", { name: "运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("评价客服回复质量");
  await page.getByRole("button", { name: "+ 手动添加维度" }).click();
  await page.getByLabel("维度 1 名称").fill("准确性");
  await page.getByLabel("维度 1 说明").fill("回答是否准确");
  await page
    .getByRole("button", { name: "按定义补齐维度 1 Rubric" })
    .click();
  await page.getByLabel("评价 Prompt").fill("请按所选维度严格评价。");
  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  await expect.poll(() => evaluateCalls.length).toBe(1);
  await expect(page.getByText("Mock summary", { exact: true })).toBeVisible();

  return { runCalls, evaluateCalls };
}

test("adds only new dimensions with an exact Judge-call preview and lineage", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { runCalls, evaluateCalls } = await prepareSourceEvaluation(page);

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await expect(page.getByRole("heading", { name: "历史评价（1）" })).toBeVisible();
  await page.getByRole("button", { name: "新增维度评价" }).click();

  await expect(
    page.getByText("只新增裁判维度，不重新跑模型或算法", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("准确性", { exact: true })).toBeVisible();
  expect(evaluateCalls).toHaveLength(1);
  expect(runCalls).toHaveLength(1);

  await page.getByRole("button", { name: "+ 手动添加维度" }).click();
  await page.getByLabel("维度 1 名称").fill(" 准确性 ");
  await expect(page.getByText(/以下维度与来源评价.*重复/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "预览并确认新增维度评价" })
  ).toBeDisabled();

  await page.getByLabel("维度 1 名称").fill("风格自然度");
  await page.getByLabel("维度 1 说明").fill("表达是否自然、符合语境");
  await page
    .getByRole("button", { name: "按定义补齐维度 1 Rubric" })
    .click();
  await page
    .getByRole("button", { name: "预览并确认新增维度评价" })
    .click();

  const dialog = page.getByRole("dialog", { name: "确认新增维度评价" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("1 次", { exact: true })).toBeVisible();
  await expect(dialog.getByText("0 次", { exact: true })).toBeVisible();
  await expect(dialog.getByText("1 条", { exact: true })).toBeVisible();
  await expect(dialog.getByText("风格自然度", { exact: true })).toBeVisible();
  expect(evaluateCalls).toHaveLength(1);
  expect(runCalls).toHaveLength(1);

  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations
      .filter(
        (violation) =>
          violation.impact === "critical" || violation.impact === "serious"
      )
      .map((violation) => violation.id)
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.screenshot({
      path: "docs/evidence/pr-03e/new-dimension-confirmation.png",
      fullPage: true,
    });
  }

  await dialog.getByRole("button", { name: "确认并开始评价" }).click();
  await expect.poll(() => evaluateCalls.length).toBe(2);
  expect(evaluateCalls[1].dimensions).toEqual([
    {
      name: "风格自然度",
      desc: "表达是否自然、符合语境",
      scoreLevels: [
        {
          score: 0,
          criteria:
            "完全不满足“风格自然度”：存在关键错误、明显违规或结果不可用。",
        },
        {
          score: 5,
          criteria: "部分满足“风格自然度”，但仍有影响使用的明显缺陷。",
        },
        {
          score: 10,
          criteria:
            "完全满足“风格自然度”：表达是否自然、符合语境，且没有可见缺陷。",
        },
      ],
      evidenceRequirements: [
        "指出输出中直接支持或违反“风格自然度”定义的具体内容；若关键内容缺失，明确说明缺失项。",
      ],
      judgeInstruction:
        "先定位可核验的输出证据，再与 0/5/10 评分锚点比较；介于锚点时按缺陷严重度给出 0–10 分，最多 1 位小数。",
    },
  ]);
  expect(runCalls).toHaveLength(1);

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await expect(page.getByRole("heading", { name: "历史评价（2）" })).toBeVisible();
  const historyRows = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /历史评价/ }) })
    .locator("li");
  await expect(historyRows.first()).toContainText("新增维度");
  await expect(historyRows.first()).toContainText("来源评价");
  await expect(historyRows.nth(1)).not.toContainText("新增维度 · 来源评价");
});
