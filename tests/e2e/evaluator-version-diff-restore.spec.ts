import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

test("previews version Diff and restores history as a new immutable version", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const rubric = structuredRubric(
    "客服上线质量",
    "回复必须准确、完整并满足上线要求"
  );
  const v1Prompt = "第一步：核对事实\n第二步：检查格式\n第三步：给分";
  const v2Prompt = "第一步：核对事实\n第二步：检查安全规则\n第三步：给分";
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
        body: JSON.stringify({ evalPrompt: v1Prompt }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (pathname === "/api/evaluate") {
      evaluateCalls.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({ error: "Diff/restore must not call Judge" }),
        contentType: "application/json",
        status: 500,
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
  await page.getByLabel("业务场景").fill("客服回复版本回退验收");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 客服上线质量").check();
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page
    .getByRole("button", { name: "按维度自动生成评价 Prompt" })
    .click();

  const versionPanel = page.getByLabel("Evaluator 版本管理");
  await versionPanel.getByLabel("Evaluator 名称").fill("客服上线评价器");
  await versionPanel.getByLabel("Evaluator 修改人").fill("Lu");
  await versionPanel
    .getByLabel("Evaluator 变更说明")
    .fill("建立首版口径");
  await versionPanel
    .getByRole("button", { name: "保存为 Evaluator v1" })
    .click();
  await expect(
    versionPanel.getByText("已绑定不可变版本：客服上线评价器 v1")
  ).toBeVisible();

  await page.getByLabel("评价 Prompt").fill(v2Prompt);
  await versionPanel
    .getByLabel("Evaluator 变更说明")
    .fill("增加安全检查");
  await versionPanel
    .getByRole("button", { name: "保存为新版本 v2" })
    .click();
  await expect(versionPanel.getByText("已保存 2 个版本")).toBeVisible();

  const diffPanel = versionPanel.getByLabel("Evaluator 版本差异与恢复");
  await expect(diffPanel.getByText("v1 → v2", { exact: true })).toBeVisible();
  await expect(diffPanel.getByText("裁判指令会变化")).toBeVisible();
  await expect(diffPanel.getByText("结构字段无变化。")).toBeVisible();
  await expect(diffPanel.getByText("第二步：检查格式", { exact: true })).toBeVisible();
  await expect(
    diffPanel.getByText("第二步：检查安全规则", { exact: true })
  ).toBeVisible();
  await expect(diffPanel.getByText("当前选中版本已是家族最新版，无需恢复。")).toBeVisible();
  expect(evaluateCalls).toHaveLength(0);

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
  await expect(diffPanel.getByText("v2 → v1", { exact: true })).toBeVisible();
  await versionPanel.getByLabel("Evaluator 修改人").fill("Release Owner");
  await versionPanel
    .getByLabel("Evaluator 变更说明")
    .fill("回退误加规则");
  await diffPanel
    .getByRole("button", { name: "恢复 v1 为新版本 v3" })
    .click();

  await expect(versionPanel.getByText("已保存 3 个版本")).toBeVisible();
  await expect(
    versionPanel.getByText("已绑定不可变版本：客服上线评价器 v3")
  ).toBeVisible();
  await expect(versionPanel.getByText("从 v1 恢复：回退误加规则")).toBeVisible();
  await expect(diffPanel.getByText("v1 → v3", { exact: true })).toBeVisible();
  await expect(diffPanel.getByText("执行定义完全一致")).toBeVisible();
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(v1Prompt);
  expect(evaluateCalls).toHaveLength(0);

  const v3Id = await versionSelect
    .locator("option")
    .filter({ hasText: "客服上线评价器 v3" })
    .getAttribute("value");
  expect(v3Id).toBeTruthy();
  await versionSelect.selectOption(v2Id!);
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(v2Prompt);
  await versionSelect.selectOption(v1Id!);
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(v1Prompt);
  await versionSelect.selectOption(v3Id!);
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(v1Prompt);

  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  const reloadedVersionPanel = page.getByLabel("Evaluator 版本管理");
  await expect(reloadedVersionPanel.getByText("已保存 3 个版本")).toBeVisible();
  await reloadedVersionPanel
    .getByLabel("加载 Evaluator 版本")
    .selectOption(v3Id!);
  await expect(page.getByLabel("评价 Prompt")).toHaveValue(v1Prompt);
  await expect(
    reloadedVersionPanel.getByText(
      "已绑定不可变版本：客服上线评价器 v3"
    )
  ).toBeVisible();
  const reloadedDiffPanel = reloadedVersionPanel.getByLabel(
    "Evaluator 版本差异与恢复"
  );
  await reloadedDiffPanel
    .getByLabel("Evaluator Diff 基线版本")
    .selectOption(v1Id!);
  await expect(
    reloadedDiffPanel.getByText("v1 → v3", { exact: true })
  ).toBeVisible();
  await expect(reloadedDiffPanel.getByText("执行定义完全一致")).toBeVisible();
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
    await reloadedVersionPanel.screenshot({
      path: "docs/evidence/pr-05c/version-diff-restore.png",
    });
  }
});
