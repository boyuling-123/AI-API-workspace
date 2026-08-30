import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

test("re-ranks saved evaluation results by selected dimensions without model calls", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const runCalls: Record<string, unknown>[] = [];
  const evaluateCalls: Record<string, unknown>[] = [];
  const unexpectedApiCalls: string[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      const body = route.request().postDataJSON() as {
        prompt: string;
        target: { id: string };
      };
      runCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outputText: `${body.target.id} 对 ${body.prompt} 的 Mock 输出`,
          outputImages: [],
        }),
      });
      return;
    }

    if (pathname === "/api/gen-dimensions") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dimensions: [
            structuredRubric("准确性", "事实、约束和关键字段是否正确"),
            structuredRubric("表达清晰度", "结构是否清楚且容易理解"),
          ],
        }),
      });
      return;
    }

    if (pathname === "/api/gen-eval-prompt") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ evalPrompt: "Mock leaderboard Judge Prompt" }),
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
      const caseIndex = evaluateCalls.length;
      evaluateCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          inputId: body.item.inputId,
          scores: body.item.targets.map((target) => {
            const isDeepSeek = target.targetId.includes("deepseek");
            const accuracy = isDeepSeek ? 9 : caseIndex === 0 ? 7 : 8;
            const clarity = isDeepSeek ? 6 : caseIndex === 0 ? 9 : 10;
            return {
              targetId: target.targetId,
              targetName: target.targetName,
              dimensionScores: [
                {
                  dimension: "准确性",
                  score: accuracy,
                  comment: `准确性评分 ${accuracy}`,
                },
                {
                  dimension: "表达清晰度",
                  score: clarity,
                  comment: `表达清晰度评分 ${clarity}`,
                },
              ],
              weightedScore: (accuracy + clarity) / 2,
              vetoed: false,
              vetoReasons: [],
              overallComment: `${target.targetName} Case ${caseIndex + 1} 点评`,
            };
          }),
          summary: `Case ${caseIndex + 1} 已完成独立评分`,
          recommendation: "按维度查看差异",
        }),
      });
      return;
    }

    unexpectedApiCalls.push(pathname);
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: `Unexpected API call: ${pathname}` }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "批量导入" }).click();
  const inputSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "输入数据" }) });
  for (let index = 1; index <= 2; index += 1) {
    await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
    await inputSection
      .locator("tbody tr")
      .last()
      .locator("input")
      .first()
      .fill(`排行榜 Case ${index}`);
  }

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: /Kimi K2.6/ }).click();
  await page.getByRole("button", { name: "批量运行", exact: true }).click();
  await expect.poll(() => runCalls.length).toBe(4);
  await expect(
    page.getByRole("button", { name: "批量运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("比较模型的准确性和表达清晰度");
  await page.getByLabel("业务场景").fill("模型上线前横向评估");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 准确性").check();
  await page.getByLabel("选择维度 表达清晰度").check();
  await expect(page.getByLabel("维度 1 权重")).toHaveValue("50");
  await expect(page.getByLabel("维度 2 权重")).toHaveValue("50");
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page
    .getByRole("button", { name: "按维度自动生成评价 Prompt" })
    .click();
  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  await page
    .getByRole("dialog", { name: "确认正式 AI 评价" })
    .getByRole("button", { name: "确认并开始评价" })
    .click();
  await expect.poll(() => evaluateCalls.length).toBe(2);
  await expect(page.getByText("保存中…", { exact: true })).toBeVisible();
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const leaderboard = page.getByLabel("评价排行榜");
  await expect(
    leaderboard.getByRole("heading", { name: "综合排行榜" })
  ).toBeVisible();
  await expect(leaderboard.getByText("正式排名 2/2 个模型")).toBeVisible();
  await expect(leaderboard.getByText("当前权重：准确性 50% · 表达清晰度 50%"))
    .toBeVisible();

  const kimiCard = leaderboard.getByLabel(/Kimi K2.6.*排名结果/);
  const deepSeekCard = leaderboard.getByLabel(/DeepSeek V4 Pro.*排名结果/);
  await expect(kimiCard.getByLabel("第 1 名")).toBeVisible();
  await expect(kimiCard.getByLabel("当前综合分 8.50")).toBeVisible();
  await expect(deepSeekCard.getByLabel("第 2 名")).toBeVisible();
  await expect(deepSeekCard.getByLabel("当前综合分 7.50")).toBeVisible();

  const apiCallCountBeforeRerank = runCalls.length + evaluateCalls.length;
  await leaderboard.getByRole("button", { name: "只看 准确性" }).click();
  await expect(
    leaderboard.getByRole("heading", { name: "单维度排行榜 · 准确性" })
  ).toBeVisible();
  await expect(leaderboard.getByText("当前权重：准确性 100%"))
    .toBeVisible();
  await expect(deepSeekCard.getByLabel("第 1 名")).toBeVisible();
  await expect(deepSeekCard.getByLabel("当前综合分 9.00")).toBeVisible();
  await expect(kimiCard.getByLabel("第 2 名")).toBeVisible();
  await expect(kimiCard.getByLabel("当前综合分 7.50")).toBeVisible();
  expect(runCalls.length + evaluateCalls.length).toBe(apiCallCountBeforeRerank);
  expect(unexpectedApiCalls).toEqual([]);

  await leaderboard.getByRole("link", { name: "下钻原始 Case 明细" }).click();
  await expect(page).toHaveURL(/#evaluation-case-details-/);
  const detail = page.locator("section[id^='evaluation-case-details-']");
  await expect(detail.locator('td[title="准确性评分 9"]').first()).toBeVisible();
  await expect(detail.getByText("排行榜 Case 1", { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="评价排行榜"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1150 });
    await leaderboard.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await page.screenshot({
      path: "docs/evidence/pr-07b/evaluation-leaderboard.png",
      fullPage: false,
    });
  }

  await page.reload();
  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const reloadedLeaderboard = page.getByLabel("评价排行榜");
  await expect(
    reloadedLeaderboard.getByRole("heading", { name: "综合排行榜" })
  ).toBeVisible();
  await expect(
    reloadedLeaderboard
      .getByLabel(/Kimi K2.6.*排名结果/)
      .getByLabel("当前综合分 8.50")
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true);
  expect(runCalls.length).toBe(4);
  expect(evaluateCalls.length).toBe(2);
  expect(unexpectedApiCalls).toEqual([]);
});
