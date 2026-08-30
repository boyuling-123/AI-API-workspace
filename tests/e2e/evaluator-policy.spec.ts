import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

test("confirms weights and veto rules before deterministic evaluation", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const rubric = structuredRubric(
    "上线合规性",
    "输出必须满足业务硬规则且不包含禁止内容"
  );
  const promptCalls: Record<string, unknown>[] = [];
  const evaluateCalls: Record<string, unknown>[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      await route.fulfill({
        body: JSON.stringify({
          outputText: "Mock answer with a compliance issue",
          outputImages: [],
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (pathname === "/api/gen-dimensions") {
      await route.fulfill({
        body: JSON.stringify({ dimensions: [rubric] }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (pathname === "/api/gen-eval-prompt") {
      promptCalls.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({
          evalPrompt: "Mock policy-aware Judge Prompt",
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (pathname === "/api/evaluate") {
      const body = route.request().postDataJSON() as {
        item: {
          inputId: string;
          targets: { targetId: string; targetName: string }[];
        };
      };
      evaluateCalls.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({
          inputId: body.item.inputId,
          scores: body.item.targets.map((target) => ({
            targetId: target.targetId,
            targetName: target.targetName,
            dimensionScores: [
              {
                dimension: "上线合规性",
                score: 4,
                comment: "命中禁止内容",
              },
            ],
            weightedScore: 4,
            vetoed: true,
            vetoReasons: ["“上线合规性”得分 4.0，低于否决阈值 6"],
            overallComment: "需修正后再上线",
          })),
          summary: "平台策略判定为已否决",
          recommendation: "当前输出不建议上线",
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
  await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
  await inputSection.locator("tbody tr input").first().fill("检查上线合规性");
  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("判断结果能否上线");
  await page.getByLabel("业务场景").fill("客服回复发布前验收");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 上线合规性").check();

  const weightInput = page.getByLabel("维度 1 权重");
  await expect(weightInput).toHaveValue("100");
  await weightInput.fill("80");
  await expect(page.getByText(/权重合计必须为 100%.*当前为 80%/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "确认评价策略" })
  ).toBeDisabled();

  await page.getByRole("button", { name: "平均分配权重" }).click();
  await expect(weightInput).toHaveValue("100");
  await page.getByLabel("维度 1 启用一票否决").check();
  await page.getByLabel("维度 1 否决阈值").fill("5");
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await expect(page.getByText("当前策略已锁定，可生成 Judge Prompt")).toBeVisible();

  await page.getByLabel("维度 1 否决阈值").fill("6");
  await expect(page.getByText("尚未确认或内容已变化")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "按维度自动生成评价 Prompt" })
  ).toBeDisabled();
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page
    .getByRole("button", { name: "按维度自动生成评价 Prompt" })
    .click();

  await expect.poll(() => promptCalls.length).toBe(1);
  expect(promptCalls[0]).toMatchObject({
    dimensions: [{ ...rubric, weight: 100, vetoThreshold: 6 }],
  });
  expect(evaluateCalls).toHaveLength(0);

  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  await page
    .getByRole("dialog", { name: "确认正式 AI 评价" })
    .getByRole("button", { name: "确认并开始评价" })
    .click();
  await expect.poll(() => evaluateCalls.length).toBe(1);
  expect(evaluateCalls[0]).toMatchObject({
    dimensions: [{ ...rubric, weight: 100, vetoThreshold: 6 }],
  });
  await expect(page.getByText("4.00", { exact: true })).toBeVisible();
  await expect(page.getByText("已否决", { exact: true })).toBeVisible();
  await expect(
    page.getByText("平台策略判定为已否决", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations
      .filter(
        (violation) =>
          violation.impact === "critical" || violation.impact === "serious"
      )
      .map((violation) => ({
        id: violation.id,
        targets: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          summary: node.failureSummary,
        })),
      }))
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1300 });
    await page.getByLabel("评价策略确认").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -140));
    await page.screenshot({
      path: "docs/evidence/pr-05a/evaluator-policy.png",
      fullPage: false,
    });
  }

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await expect(
    page.getByRole("heading", { name: "历史评价（1）" })
  ).toBeVisible();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const historyDetail = page.locator("section").filter({
    has: page.getByRole("heading", { name: "评价详情（按维度）" }),
  });
  await expect(historyDetail.getByText("4.00", { exact: true })).toBeVisible();
  await expect(historyDetail.getByText("已否决", { exact: true })).toBeVisible();
  await expect(
    historyDetail.locator(
      'td[title="“上线合规性”得分 4.0，低于否决阈值 6"]'
    )
  ).toBeVisible();
});
