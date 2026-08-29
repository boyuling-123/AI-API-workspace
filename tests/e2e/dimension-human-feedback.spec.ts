import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

interface DimensionHumanFeedbackCall {
  modelId: string;
  request: {
    samples: {
      prompt: string;
      humanFeedback?: {
        mode: "scores" | "ranking";
        judgments: {
          targetId: string;
          score?: number;
          rank?: number;
        }[];
        note?: string;
      };
    }[];
  };
}

test("requires complete human scores and preference rankings", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const runCalls: { prompt: string; targetId: string }[] = [];
  const dimensionCalls: DimensionHumanFeedbackCall[] = [];
  let evaluateCalls = 0;

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      const body = route.request().postDataJSON() as {
        prompt: string;
        target: { id: string };
      };
      runCalls.push({ prompt: body.prompt, targetId: body.target.id });
      await route.fulfill({
        body: JSON.stringify({
          outputText: `Mock ${body.target.id} answer for ${body.prompt}`,
          outputImages: [],
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (pathname === "/api/gen-dimensions") {
      dimensionCalls.push(
        route.request().postDataJSON() as DimensionHumanFeedbackCall
      );
      await route.fulfill({
        body: JSON.stringify({
          dimensions: [
            {
              name: "人工偏好贴合度",
              desc: "输出是否符合人工评分和偏好排序反映的质量标准",
            },
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
  await page.getByLabel("评测目标").fill("从人工偏好中提炼上线评价维度");
  await page.getByLabel("业务场景").fill("客服回复质量评审");
  await expect(
    page.getByText(
      "已选 2/2 条 · Bad Case 0 条 · 人工反馈 0 条",
      { exact: true }
    )
  ).toBeVisible();

  await page.getByRole("button", { name: "添加 Case 1 人工反馈" }).click();
  await expect(page.getByText("DeepSeek V4 Pro 尚未填写人工评分")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "AI 生成评价维度" })
  ).toBeDisabled();
  expect(dimensionCalls).toHaveLength(0);

  await page.getByLabel("Case 1 DeepSeek V4 Pro 人工评分").fill("9.5");
  await page.getByLabel(/Case 1 Kimi K2.6.*人工评分/).fill("6");
  await page
    .getByLabel("Case 1 人工反馈备注")
    .fill("DeepSeek 的追问步骤更完整");

  await page.getByRole("button", { name: "添加 Case 2 人工反馈" }).click();
  await page.getByLabel("Case 2 人工反馈模式").selectOption("ranking");
  await page.getByLabel("Case 2 DeepSeek V4 Pro 偏好名次").fill("1");
  await page.getByLabel(/Case 2 Kimi K2.6.*偏好名次/).fill("1");
  await expect(
    page.getByText("偏好名次不能重复，且必须完整覆盖 1–2")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "AI 生成评价维度" })
  ).toBeDisabled();
  expect(dimensionCalls).toHaveLength(0);
  expect(evaluateCalls).toBe(0);

  await page.getByLabel(/Case 2 Kimi K2.6.*偏好名次/).fill("2");
  await page
    .getByLabel("Case 2 人工反馈备注")
    .fill("DeepSeek 更符合人工偏好");
  await expect(
    page.getByText(
      "已选 2/2 条 · Bad Case 0 条 · 人工反馈 2 条",
      { exact: true }
    )
  ).toBeVisible();
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
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({
      path: "docs/evidence/pr-04c/human-score-ranking.png",
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await expect.poll(() => dimensionCalls.length).toBe(1);
  await expect(page.getByLabel("维度 1 名称")).toHaveValue(
    "人工偏好贴合度"
  );
  expect(evaluateCalls).toBe(0);

  const call = dimensionCalls[0];
  expect(call.modelId).toBe("qwen3.6-plus");
  expect(call.request.samples).toHaveLength(2);
  expect(
    call.request.samples.find((sample) => sample.prompt === "Case 1")
      ?.humanFeedback
  ).toEqual({
    mode: "scores",
    judgments: [
      { targetId: "deepseek-v4-pro", score: 9.5 },
      { targetId: "kimi-k2.6", score: 6 },
    ],
    note: "DeepSeek 的追问步骤更完整",
  });
  expect(
    call.request.samples.find((sample) => sample.prompt === "Case 2")
      ?.humanFeedback
  ).toEqual({
    mode: "ranking",
    judgments: [
      { targetId: "deepseek-v4-pro", rank: 1 },
      { targetId: "kimi-k2.6", rank: 2 },
    ],
    note: "DeepSeek 更符合人工偏好",
  });
});
