import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

interface DimensionGenerationCall {
  modelId: string;
  request: {
    objective: string;
    businessScenario: string;
    taskType: string;
    hardRules: string[];
    samples: {
      inputId: string;
      prompt: string;
      inputImageCount: number;
      expectedAnswer?: string;
      outputs: {
        status: string;
        outputImageCount: number;
        errorType?: string;
      }[];
    }[];
  };
}

test("previews deterministic samples and generates dimensions only after a click", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const runCalls: string[] = [];
  const dimensionCalls: DimensionGenerationCall[] = [];
  let evaluateCalls = 0;

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      const body = route.request().postDataJSON() as { prompt: string };
      runCalls.push(body.prompt);
      if (body.prompt === "Case 4") {
        await route.fulfill({
          body: JSON.stringify({
            error: "Authorization: Bearer SECRET_FULL_ERROR",
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
          outputText: `Mock output for ${body.prompt}`,
          outputImages: ["data:image/png;base64,SECRET_OUTPUT_IMAGE"],
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (pathname === "/api/gen-dimensions") {
      dimensionCalls.push(
        route.request().postDataJSON() as DimensionGenerationCall
      );
      await route.fulfill({
        body: JSON.stringify({
          dimensions: [
            structuredRubric(
              "上下文贴合度",
              "回答是否贴合业务目标与代表性样本"
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
  for (let index = 1; index <= 5; index += 1) {
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
  await expect.poll(() => runCalls.length).toBe(5);
  await expect(
    page.getByRole("button", { name: "批量运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("判断回复是否可以直接上线");
  await page.getByLabel("业务场景").fill("电商售后客服，回复直接面向消费者");
  await page.getByLabel("任务类型").selectOption("text_generation");

  await expect(
    page.getByText(
      "已选 3/5 条 · Bad Case 0 条 · 人工反馈 0 条",
      { exact: true }
    )
  ).toBeVisible();
  await expect(page.getByText(/Case 1：Case 1/)).toBeVisible();
  await expect(page.getByText(/Case 3：Case 3/)).toBeVisible();
  await expect(page.getByText(/Case 5：Case 5/)).toBeVisible();
  expect(dimensionCalls).toHaveLength(0);
  expect(evaluateCalls).toBe(0);

  await page
    .getByLabel("代表性样本策略")
    .selectOption("failures_first");
  await expect(page.getByText(/Case 4：Case 4/)).toBeVisible();
  await expect(page.getByText(/失败 1/)).toBeVisible();

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
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
        })),
      }))
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.screenshot({
      path: "docs/evidence/pr-04a/dimension-sample-preview.png",
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await expect.poll(() => dimensionCalls.length).toBe(1);
  await expect(page.getByLabel("维度 1 名称")).toHaveValue("上下文贴合度");
  expect(evaluateCalls).toBe(0);

  const call = dimensionCalls[0];
  expect(call.modelId).toBe("qwen3.6-plus");
  expect(call.request).toMatchObject({
    objective: "判断回复是否可以直接上线",
    businessScenario: "电商售后客服，回复直接面向消费者",
    taskType: "text_generation",
    hardRules: [],
  });
  expect(call.request.samples).toHaveLength(3);
  expect(call.request.samples[0].prompt).toBe("Case 4");
  expect(call.request.samples[0].outputs[0]).toMatchObject({
    status: "error",
    outputImageCount: 0,
    errorType: "auth",
  });

  const serialized = JSON.stringify(call);
  expect(serialized).not.toContain("SECRET_FULL_ERROR");
  expect(serialized).not.toContain("SECRET_OUTPUT_IMAGE");
  expect(serialized).not.toContain("data:image");
});
