import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

interface DimensionRulesCall {
  modelId: string;
  request: {
    hardRules: string[];
    samples: {
      prompt: string;
      badCaseReason?: string;
      outputs: { status: string; errorType?: string }[];
    }[];
  };
}

test("requires explicit Bad Case reasons and sends bounded hard rules", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const runCalls: string[] = [];
  const dimensionCalls: DimensionRulesCall[] = [];
  let evaluateCalls = 0;

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      const body = route.request().postDataJSON() as { prompt: string };
      runCalls.push(body.prompt);
      if (body.prompt === "Case 2") {
        await route.fulfill({
          body: JSON.stringify({
            error: "完整诊断内容 SECRET_BAD_CASE_ERROR",
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
          outputText: "Mock safe answer",
          outputImages: ["data:image/png;base64,SECRET_RULE_IMAGE"],
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (pathname === "/api/gen-dimensions") {
      dimensionCalls.push(route.request().postDataJSON() as DimensionRulesCall);
      await route.fulfill({
        body: JSON.stringify({
          dimensions: [
            structuredRubric(
              "规则遵循度",
              "回答是否满足明确硬规则并规避 Bad Case 风险"
            ),
          ],
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
  await expect(
    page.getByRole("tablist", { name: "工作区功能导航" })
  ).toBeVisible();
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
      .fill(`Case ${index}`);
  }

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: "批量运行", exact: true }).click();
  await expect.poll(() => runCalls.length).toBe(2);
  await expect(
    page.getByRole("button", { name: "批量运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("提炼客服上线评价维度");
  await page.getByLabel("业务场景").fill("退款售后回复直接发送给消费者");
  await page
    .getByLabel("维度生成硬规则")
    .fill("不得承诺未确认的退款时效\n涉及账户信息时必须先核验身份");
  await expect(page.getByText("2/20 条", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "标记 Case 2 Bad Case" }).click();
  await expect(
    page.getByText("已标记的 Bad Case 必须填写原因，补充完成后才能生成维度。")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "AI 生成评价维度" })
  ).toBeDisabled();
  expect(dimensionCalls).toHaveLength(0);
  expect(evaluateCalls).toBe(0);

  await page
    .getByLabel("Case 2 Bad Case 原因")
    .fill("失败输出无法完成鉴权，代表上线配置风险");
  await expect(
    page.getByRole("button", { name: "AI 生成评价维度" })
  ).toBeEnabled();

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
        nodes: violation.nodes.map((node) => node.target),
      }))
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({
      path: "docs/evidence/pr-04b/hard-rules-bad-case.png",
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await expect.poll(() => dimensionCalls.length).toBe(1);
  await expect(page.getByLabel("维度 1 名称")).toHaveValue("规则遵循度");
  expect(evaluateCalls).toBe(0);

  const call = dimensionCalls[0];
  expect(call.modelId).toBe("qwen3.6-plus");
  expect(call.request.hardRules).toEqual([
    "不得承诺未确认的退款时效",
    "涉及账户信息时必须先核验身份",
  ]);
  expect(call.request.samples).toHaveLength(2);
  expect(
    call.request.samples.find((sample) => sample.prompt === "Case 2")
  ).toMatchObject({
    badCaseReason: "失败输出无法完成鉴权，代表上线配置风险",
    outputs: [{ status: "error", errorType: "auth" }],
  });

  const serialized = JSON.stringify(call);
  expect(serialized).not.toContain("SECRET_BAD_CASE_ERROR");
  expect(serialized).not.toContain("SECRET_RULE_IMAGE");
  expect(serialized).not.toContain("data:image");
});
