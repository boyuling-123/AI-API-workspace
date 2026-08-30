import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

test("appends human review versions without changing AI scores or calling models", async ({
  page,
}) => {
  test.setTimeout(90_000);
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
            structuredRubric("准确性", "事实和关键结论是否正确"),
          ],
        }),
      });
      return;
    }

    if (pathname === "/api/gen-eval-prompt") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ evalPrompt: "Mock human review Judge Prompt" }),
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
      evaluateCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          inputId: body.item.inputId,
          scores: body.item.targets.map((target) => ({
            targetId: target.targetId,
            targetName: target.targetName,
            dimensionScores: [
              {
                dimension: "准确性",
                score: 4,
                comment: "AI 判断存在事实错误",
              },
            ],
            weightedScore: 4,
            vetoed: false,
            vetoReasons: [],
            overallComment: "AI 原始点评",
          })),
          summary: "AI 原始总结",
          recommendation: "建议人工复核",
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
  await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
  await inputSection
    .locator("tbody tr")
    .last()
    .locator("input")
    .first()
    .fill("人工复核 Case 1");

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
  await page.getByLabel("评测目标").fill("复核模型答案准确性");
  await page.getByLabel("业务场景").fill("上线前人工质检");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 准确性").check();
  await expect(page.getByLabel("维度 1 权重")).toHaveValue("100");
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page
    .getByRole("button", { name: "按维度自动生成评价 Prompt" })
    .click();
  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  await page
    .getByRole("dialog", { name: "确认正式 AI 评价" })
    .getByRole("button", { name: "确认并开始评价" })
    .click();
  await expect.poll(() => evaluateCalls.length).toBe(1);
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const leaderboard = page.getByLabel("评价排行榜");
  await expect(
    leaderboard.getByLabel("当前综合分 4.00")
  ).toBeVisible();
  const detail = page.locator("section[id^='evaluation-case-details-']");
  await expect(
    detail.getByText("排行榜继续使用 AI 原分", { exact: false })
  ).toBeVisible();

  const reviewButton = detail.getByRole("button", {
    name: "人工复核 第1条 DeepSeek V4 Pro",
  });
  await reviewButton.click();
  let editor = detail.getByLabel("人工复核编辑器");
  await expect(editor.getByText("只追加审计 · 0 次模型调用")).toBeVisible();
  await editor.getByRole("button", { name: "保存人工复核版本" }).click();
  await expect(editor.getByRole("alert")).toHaveText("修改理由不能为空");

  await editor.getByLabel("人工复核修改人").fill("质检员A");
  await editor.getByLabel("人工评分 准确性").fill("8.5");
  await editor.getByLabel("标记为 Bad Case").check();
  await editor.getByLabel("人工复核理由").fill("人工核验后答案事实正确，但样本应加入回归集");
  const apiCallCountBeforeReview = runCalls.length + evaluateCalls.length;
  await editor.getByRole("button", { name: "保存人工复核版本" }).click();
  await expect(
    detail.getByRole("status").filter({ hasText: "AI 原始评分未被修改" })
  ).toBeVisible();
  expect(runCalls.length + evaluateCalls.length).toBe(apiCallCountBeforeReview);

  let resultRow = detail
    .locator("tbody tr")
    .filter({ hasText: "DeepSeek V4 Pro" })
    .first();
  await expect(resultRow.getByLabel("人工有效分 8.5")).toBeVisible();
  await expect(resultRow.getByText("AI 4.0", { exact: true })).toBeVisible();
  await expect(resultRow.getByLabel("人工有效加权分 8.50")).toBeVisible();
  await expect(resultRow.getByText("AI 4.00", { exact: true })).toBeVisible();
  await expect(resultRow.getByText("最新：质检员A", { exact: true })).toBeVisible();
  await expect(resultRow.getByText("Bad Case", { exact: true })).toBeVisible();
  await expect(leaderboard.getByLabel("当前综合分 4.00")).toBeVisible();

  await reviewButton.click();
  editor = detail.getByLabel("人工复核编辑器");
  await expect(editor.getByText("人工复核历史（1）")).toBeVisible();
  await expect(editor.getByLabel("人工评分 准确性")).toHaveValue("8.5");
  await editor.getByLabel("人工复核修改人").fill("质检员B");
  await editor.getByLabel("人工评分 准确性").fill("7");
  await editor.getByLabel("标记为 Bad Case").uncheck();
  await editor.getByLabel("人工复核理由").fill("二次复核下调，保留为普通样本");
  await editor.getByRole("button", { name: "保存人工复核版本" }).click();
  expect(runCalls.length + evaluateCalls.length).toBe(apiCallCountBeforeReview);

  resultRow = detail
    .locator("tbody tr")
    .filter({ hasText: "DeepSeek V4 Pro" })
    .first();
  await expect(resultRow.getByLabel("人工有效分 7.0")).toBeVisible();
  await expect(resultRow.getByLabel("人工有效加权分 7.00")).toBeVisible();
  await expect(resultRow.getByText("最新：质检员B", { exact: true })).toBeVisible();
  await expect(resultRow.getByText("Bad Case", { exact: true })).toHaveCount(0);

  await reviewButton.click();
  editor = detail.getByLabel("人工复核编辑器");
  await expect(editor.getByText("人工复核历史（2）")).toBeVisible();
  await expect(editor.getByText("二次复核下调，保留为普通样本")).toBeVisible();
  await expect(
    editor.getByText("人工核验后答案事实正确，但样本应加入回归集")
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="人工复核编辑器"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await editor.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await page.screenshot({
      path: "docs/evidence/pr-07d/evaluation-human-review.png",
      fullPage: false,
    });
  }

  await page.reload();
  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const reloadedDetail = page.locator("section[id^='evaluation-case-details-']");
  const reloadedRow = reloadedDetail
    .locator("tbody tr")
    .filter({ hasText: "DeepSeek V4 Pro" })
    .first();
  await expect(reloadedRow.getByLabel("人工有效加权分 7.00")).toBeVisible();
  await expect(reloadedRow.getByText("AI 4.00", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("评价排行榜").getByLabel("当前综合分 4.00")
  ).toBeVisible();
  await reloadedDetail
    .getByRole("button", { name: "人工复核 第1条 DeepSeek V4 Pro" })
    .click();
  await expect(
    reloadedDetail.getByLabel("人工复核编辑器").getByText("人工复核历史（2）")
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true);
  expect(runCalls.length).toBe(1);
  expect(evaluateCalls.length).toBe(1);
  expect(unexpectedApiCalls).toEqual([]);
});
