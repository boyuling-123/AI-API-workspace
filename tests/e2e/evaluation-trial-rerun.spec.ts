import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

interface EvaluateCall {
  item: {
    inputId: string;
    prompt: string;
    targets: { targetId: string; targetName: string }[];
  };
  dimensions: { name: string }[];
  evalPrompt: string;
}

async function prepareEvaluator(page: Page, evalPrompt: string): Promise<void> {
  await page.getByLabel("启用 AI 自评").check();
  await expect(
    page.getByText("已复用该批次的模型或算法输出", { exact: true })
  ).toBeVisible();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("判断输出能否直接上线");
  await page.getByRole("button", { name: "+ 手动添加维度" }).click();
  await page.getByLabel("维度 1 名称").fill("准确性");
  await page.getByLabel("维度 1 说明").fill("回答是否准确并覆盖关键信息");
  await page
    .getByRole("button", { name: "按定义补齐维度 1 Rubric" })
    .click();
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page.getByLabel("评价 Prompt").fill(evalPrompt);
}

async function openReusableTaskEvaluation(page: Page): Promise<void> {
  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page
    .getByRole("button", { name: "复用输出去AI评测" })
    .click();
}

async function confirmFormalEvaluation(page: Page): Promise<void> {
  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  const dialog = page.getByRole("dialog", { name: "确认正式 AI 评价" });
  await expect(dialog.getByText("0 次", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "确认并开始评价" }).click();
}

test("trials a small sample without history, then re-evaluates reused outputs independently", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const runCalls: string[] = [];
  const evaluateCalls: EvaluateCall[] = [];
  let failTrialCase = true;

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      const body = route.request().postDataJSON() as { prompt: string };
      runCalls.push(body.prompt);
      await route.fulfill({
        body: JSON.stringify({
          outputText: `Existing output for ${body.prompt}`,
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
      if (failTrialCase && body.item.prompt === "Case 2") {
        await route.fulfill({
          body: JSON.stringify({ error: "裁判输出 JSON 解析失败" }),
          contentType: "application/json",
          status: 422,
        });
        return;
      }
      await route.fulfill({
        body: JSON.stringify({
          inputId: body.item.inputId,
          scores: body.item.targets.map((target) => ({
            targetId: target.targetId,
            targetName: target.targetName,
            dimensionScores: body.dimensions.map((dimension) => ({
              dimension: dimension.name,
              score: 8,
              comment: "Mock evidence",
            })),
            weightedScore: 8,
            vetoed: false,
            vetoReasons: [],
            overallComment: "Mock acceptable output",
          })),
          summary: `Completed with ${body.evalPrompt}`,
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
  await page.getByRole("button", { name: "批量导入" }).click();
  const inputSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "输入数据" }) });
  for (const prompt of ["Case 1", "Case 2", "Case 3"]) {
    await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
    await inputSection
      .locator("tbody tr")
      .last()
      .locator("input")
      .first()
      .fill(prompt);
  }
  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: "批量运行", exact: true }).click();
  await expect.poll(() => runCalls.length).toBe(3);
  await expect(
    page.getByRole("button", { name: "批量运行", exact: true })
  ).toBeEnabled();

  await openReusableTaskEvaluation(page);
  await prepareEvaluator(page, "Trial Judge Prompt");
  await page.getByLabel("试评样本数").selectOption("2");
  await page.getByRole("button", { name: "试评 2 条（不写历史）" }).click();

  const trialDialog = page.getByRole("dialog", { name: "确认少量样本试评" });
  await expect(trialDialog.getByText("2 次", { exact: true })).toBeVisible();
  await expect(trialDialog.getByText("0 次", { exact: true })).toBeVisible();
  await expect(trialDialog.getByText("2 条", { exact: true })).toBeVisible();
  await expect(trialDialog.getByText("不写入", { exact: true })).toBeVisible();
  expect(evaluateCalls).toHaveLength(0);
  expect(runCalls).toHaveLength(3);

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
    await page.evaluate(() => {
      document
        .querySelector('[aria-label="评价执行"]')
        ?.scrollIntoView({ block: "center" });
    });
    await page.screenshot({
      path: "docs/evidence/pr-05d/evaluation-trial-confirm.png",
      fullPage: false,
    });
  }

  await trialDialog
    .getByRole("button", { name: "确认并开始试评" })
    .click();
  await expect.poll(() => evaluateCalls.length).toBe(2);
  await expect(
    page.getByText(
      "试评完成：成功 1 条，失败 1 条。结果仅保留在当前页面，未写入 AI 历史评价。",
      { exact: true }
    )
  ).toBeVisible();
  await expect(page.getByLabel("逐条评价错误")).toContainText(
    "输入 #2：裁判输出 JSON 解析失败"
  );
  expect(runCalls).toHaveLength(3);

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await expect(page.getByRole("heading", { name: "历史评价（0）" })).toBeVisible();

  failTrialCase = false;
  await openReusableTaskEvaluation(page);
  await prepareEvaluator(page, "Formal Judge Prompt v1");
  await confirmFormalEvaluation(page);
  await expect.poll(() => evaluateCalls.length).toBe(5);
  await expect(page.getByText(/正式评价完成：成功 3 条/)).toBeVisible();
  expect(runCalls).toHaveLength(3);

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await expect(page.getByRole("heading", { name: "历史评价（1）" })).toBeVisible();

  await openReusableTaskEvaluation(page);
  await prepareEvaluator(page, "Formal Judge Prompt v2");
  await confirmFormalEvaluation(page);
  await expect.poll(() => evaluateCalls.length).toBe(8);
  expect(runCalls).toHaveLength(3);

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await expect(page.getByRole("heading", { name: "历史评价（2）" })).toBeVisible();
  const historyRows = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /历史评价/ }) })
    .locator("li");
  await expect(historyRows).toHaveCount(2);
});
