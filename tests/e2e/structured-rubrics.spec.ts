import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

test("blocks incomplete Simple Rubrics before any Judge call", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const rubric = structuredRubric(
    "事实准确性",
    "判断输出中的事实是否与输入和可核验信息一致"
  );
  const promptCalls: unknown[] = [];
  let dimensionCalls = 0;
  let evaluateCalls = 0;

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      await route.fulfill({
        body: JSON.stringify({
          outputText: "Mock output for Case 1",
          outputImages: [],
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (pathname === "/api/gen-dimensions") {
      dimensionCalls += 1;
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
          evalPrompt: "Mock evidence-first evaluation prompt",
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (pathname === "/api/evaluate") {
      evaluateCalls += 1;
      await route.fulfill({
        body: JSON.stringify({ error: "本测试禁止启动 AI 评价" }),
        contentType: "application/json",
        status: 503,
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
  await inputSection.locator("tbody tr input").first().fill("Case 1");
  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("验证事实是否准确");
  await page.getByLabel("业务场景").fill("客服回复上线前质量验收");
  await page.getByLabel("评价 Prompt").fill("仅用于验证 Rubric 门禁。");

  await expect(page.getByLabel("维度生成模式")).toHaveText(
    "当前模式：Simple Rubrics（无人工评分或排序）"
  );
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await expect.poll(() => dimensionCalls).toBe(1);
  await page.getByLabel("选择维度 事实准确性").check();
  await expect(
    page.getByText("已勾选 1 个 · Rubric 完整 1 个")
  ).toBeVisible();
  await expect(page.getByLabel("维度 1 权重")).toHaveValue("100");
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await expect(
    page.getByRole("button", { name: "评价策略已确认" })
  ).toBeVisible();

  await page
    .getByText("评分锚点、证据要求与判断规则", { exact: true })
    .click();
  const fivePointCriteria = page.getByLabel("维度 1 5 分标准");
  const originalCriteria = await fivePointCriteria.inputValue();
  await fivePointCriteria.fill("");

  await expect(page.getByText(/Rubric 尚未完成：5 分标准不能为空/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "按维度自动生成评价 Prompt" })
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "开始 AI 评价" })
  ).toBeDisabled();
  expect(promptCalls).toHaveLength(0);
  expect(evaluateCalls).toBe(0);

  await fivePointCriteria.fill(originalCriteria);
  await expect(
    page.getByText("已勾选 1 个 · Rubric 完整 1 个")
  ).toBeVisible();
  await page
    .getByRole("button", { name: "按维度自动生成评价 Prompt" })
    .click();
  await expect.poll(() => promptCalls.length).toBe(1);
  expect(promptCalls[0]).toMatchObject({
    scenario: "验证事实是否准确",
    modelId: "qwen3.6-plus",
    dimensions: [{ ...rubric, weight: 100 }],
  });
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(
    "Mock evidence-first evaluation prompt"
  );
  await expect(
    page.getByRole("button", { name: "开始 AI 评价" })
  ).toBeEnabled();
  expect(evaluateCalls).toBe(0);

  const accessibility = await new AxeBuilder({ page })
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
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "docs/evidence/pr-04d/structured-simple-rubric.png",
      fullPage: true,
    });
  }
});
