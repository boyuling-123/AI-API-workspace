import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

test("saves immutable Evaluator versions and binds one to evaluation history", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const rubric = structuredRubric(
    "客服上线质量",
    "回复必须准确、完整并满足上线要求"
  );
  const evaluateCalls: unknown[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      await route.fulfill({
        body: JSON.stringify({
          outputText: "Mock customer-service answer",
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
      await route.fulfill({
        body: JSON.stringify({ evalPrompt: "Mock Evaluator v1 Prompt" }),
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
      evaluateCalls.push(body);
      await route.fulfill({
        body: JSON.stringify({
          inputId: body.item.inputId,
          scores: body.item.targets.map((target) => ({
            targetId: target.targetId,
            targetName: target.targetName,
            dimensionScores: [
              {
                dimension: "客服上线质量",
                score: 9,
                comment: "满足上线标准",
              },
            ],
            weightedScore: 9,
            vetoed: false,
            vetoReasons: [],
            overallComment: "可以上线",
          })),
          summary: "Evaluator v2 评价完成",
          recommendation: "建议上线",
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
  await inputSection.locator("tbody tr input").first().fill("检查客服回复");
  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("判断客服回复能否直接上线");
  await page.getByLabel("业务场景").fill("电商客服回复发布前验收");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 客服上线质量").check();
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page
    .getByRole("button", { name: "按维度自动生成评价 Prompt" })
    .click();
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(
    "Mock Evaluator v1 Prompt"
  );

  const versionPanel = page.getByLabel("Evaluator 版本管理");
  await expect(
    versionPanel.getByText("当前草稿尚未保存；评价历史将显示未绑定版本")
  ).toBeVisible();
  await versionPanel.getByLabel("Evaluator 名称").fill("客服上线评价器");
  await versionPanel.getByLabel("Evaluator 修改人").fill("Lu");
  await versionPanel
    .getByLabel("Evaluator 变更说明")
    .fill("建立首版上线口径");
  await versionPanel
    .getByRole("button", { name: "保存为 Evaluator v1" })
    .click();
  await expect(
    versionPanel.getByText("已绑定不可变版本：客服上线评价器 v1")
  ).toBeVisible();
  expect(evaluateCalls).toHaveLength(0);

  const v2Prompt = "Mock Evaluator v1 Prompt\n人工补充：先检查格式再判断语义。";
  await page.getByLabel("评价 Prompt").fill(v2Prompt);
  await expect(
    versionPanel.getByText("草稿已修改，旧版 v1 保持不变")
  ).toBeVisible();
  await versionPanel
    .getByLabel("Evaluator 变更说明")
    .fill("增加人工格式复核步骤");
  await versionPanel
    .getByRole("button", { name: "保存为新版本 v2" })
    .click();
  await expect(
    versionPanel.getByText("已绑定不可变版本：客服上线评价器 v2")
  ).toBeVisible();
  await expect(versionPanel.getByText("已保存 2 个版本")).toBeVisible();

  const versionSelect = versionPanel.getByLabel("加载 Evaluator 版本");
  const v1Id = await versionSelect
    .locator("option")
    .filter({ hasText: "客服上线评价器 v1" })
    .getAttribute("value");
  const v2Id = await versionSelect
    .locator("option")
    .filter({ hasText: "客服上线评价器 v2" })
    .getAttribute("value");
  expect(v1Id).toBeTruthy();
  expect(v2Id).toBeTruthy();

  await versionSelect.selectOption(v1Id!);
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(
    "Mock Evaluator v1 Prompt"
  );
  await versionSelect.selectOption(v2Id!);
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(v2Prompt);
  expect(evaluateCalls).toHaveLength(0);

  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  const reloadedVersionPanel = page.getByLabel("Evaluator 版本管理");
  await expect(reloadedVersionPanel.getByText("已保存 2 个版本")).toBeVisible();
  await reloadedVersionPanel
    .getByLabel("加载 Evaluator 版本")
    .selectOption(v2Id!);
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(v2Prompt);
  await expect(
    reloadedVersionPanel.getByText(
      "已绑定不可变版本：客服上线评价器 v2"
    )
  ).toBeVisible();
  expect(evaluateCalls).toHaveLength(0);

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
    await page.setViewportSize({ width: 1440, height: 1200 });
    await reloadedVersionPanel.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.screenshot({
      path: "docs/evidence/pr-05b/evaluator-versions.png",
      fullPage: false,
    });
  }

  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  await page
    .getByRole("dialog", { name: "确认正式 AI 评价" })
    .getByRole("button", { name: "确认并开始评价" })
    .click();
  await expect.poll(() => evaluateCalls.length).toBe(1);
  await expect(page.getByText("Evaluator v2 评价完成")).toBeVisible();
  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await expect(
    page.getByText("Evaluator：客服上线评价器 v2", { exact: true })
  ).toBeVisible();
});
