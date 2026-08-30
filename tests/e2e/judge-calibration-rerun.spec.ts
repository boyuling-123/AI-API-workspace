import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

test("creates a confirmed rerun after an Evaluator Prompt change and keeps both results", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const rubric = structuredRubric(
    "客服上线质量",
    "回复必须准确、完整并满足上线要求"
  );
  const judgeCalls: Record<string, unknown>[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outputText: "Mock customer-service answer",
          outputImages: [],
        }),
      });
      return;
    }
    if (pathname === "/api/gen-dimensions") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ dimensions: [rubric] }),
      });
      return;
    }
    if (pathname === "/api/gen-eval-prompt") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ evalPrompt: "第一版 Prompt：核对事实后评分。" }),
      });
      return;
    }
    if (pathname === "/api/judge-calibration") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      judgeCalls.push(body);
      const item = body.item as Record<string, unknown>;
      expect(item).not.toHaveProperty("humanLabel");
      expect(item).not.toHaveProperty("reviewerNote");
      const improved = String(body.criteria).includes("第二版 Prompt");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          caseId: item.caseId,
          judgeLabel: improved ? "pass" : "fail",
          confidence: improved ? 0.96 : 0.71,
          reason: improved ? "新 Prompt 正确识别可通过" : "旧 Prompt 错误拒绝",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: `Unexpected E2E route: ${pathname}` }),
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
  await expect(page.getByRole("button", { name: "运行", exact: true })).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("判断客服回复能否直接上线");
  await page.getByLabel("业务场景").fill("客服回复发布前验收");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 客服上线质量").check();
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page.getByRole("button", { name: "按维度自动生成评价 Prompt" }).click();

  const versionPanel = page.getByLabel("Evaluator 版本管理");
  await versionPanel.getByLabel("Evaluator 名称").fill("客服上线评价器");
  await versionPanel.getByLabel("Evaluator 修改人").fill("Lu");
  await versionPanel.getByLabel("Evaluator 变更说明").fill("建立校准基线");
  await versionPanel.getByRole("button", { name: "保存为 Evaluator v1" }).click();
  const versionSelect = versionPanel.getByLabel("加载 Evaluator 版本");
  const v1Id = await versionSelect
    .locator("option")
    .filter({ hasText: "客服上线评价器 v1" })
    .getAttribute("value");
  expect(v1Id).toBeTruthy();

  await page
    .getByLabel("评价 Prompt")
    .fill("第二版 Prompt：先核对格式，再核对事实后评分。");
  await versionPanel.getByLabel("Evaluator 变更说明").fill("补充格式核验顺序");
  await versionPanel.getByRole("button", { name: "保存为新版本 v2" }).click();
  const v2Id = await versionSelect
    .locator("option")
    .filter({ hasText: "客服上线评价器 v2" })
    .getAttribute("value");
  expect(v2Id).toBeTruthy();

  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  await page.getByLabel("导入黄金集文件").setInputFiles({
    name: "rerun-golden.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          case_id: "rerun-001",
          prompt: "这条客服回复能上线吗",
          candidate_output: "可以上线",
          expected_answer: "可以上线",
          human_label: "pass",
          reviewer_note: "人工确认通过",
        },
      ])
    ),
  });
  await page.getByLabel("黄金集名称").fill("Evaluator 重跑黄金集");
  await page.getByLabel("黄金集标注负责人").fill("Lu");
  await page.getByRole("button", { name: "发布并锁定 v1" }).click();

  const calibration = page.getByLabel("Judge 校准运行");
  const plan = calibration.getByLabel("Judge 校准重跑计划");
  await calibration.getByLabel("校准 Evaluator 版本").selectOption(v1Id!);
  await expect(calibration.getByLabel("校准判定标准")).toContainText(
    "第一版 Prompt"
  );
  await expect(plan.getByText("首次校准任务")).toBeVisible();
  expect(judgeCalls).toHaveLength(0);

  await calibration.getByRole("button", { name: "预览并启动校准" }).click();
  await page
    .getByRole("dialog", { name: "确认启动 Judge 校准" })
    .getByRole("button", { name: "确认并调用 1 次 Judge" })
    .click();
  await expect(calibration.getByText("校准完成：成功 1 条，失败 0 条。"))
    .toBeVisible();
  expect(judgeCalls).toHaveLength(1);
  await expect(plan.getByText("相同执行配置已有校准结果")).toBeVisible();

  await calibration.getByLabel("校准 Evaluator 版本").selectOption(v2Id!);
  await expect(calibration.getByLabel("校准判定标准")).toContainText(
    "第二版 Prompt"
  );
  await expect(plan.getByText("已自动生成配置变化重跑任务")).toBeVisible();
  await expect(plan.getByText("Prompt 已变化")).toBeVisible();
  expect(judgeCalls).toHaveLength(1);

  await calibration.getByRole("button", { name: "预览并启动重跑" }).click();
  const rerunDialog = page.getByRole("dialog", {
    name: "确认启动 Judge 校准",
  });
  await expect(rerunDialog.getByText("配置变化重跑")).toBeVisible();
  await expect(rerunDialog.getByText("Prompt 已变化")).toBeVisible();
  expect(judgeCalls).toHaveLength(1);
  await rerunDialog
    .getByRole("button", { name: "确认并调用 1 次 Judge" })
    .click();
  await expect(calibration.getByText("重跑完成：成功 1 条，失败 0 条。"))
    .toBeVisible();
  expect(judgeCalls).toHaveLength(2);

  const results = calibration.getByLabel("Judge 校准结果");
  const comparison = results.getByLabel("Judge 校准前后对比");
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole("row", { name: /准确率/ })).toContainText(
    "0.0%"
  );
  await expect(comparison.getByRole("row", { name: /准确率/ })).toContainText(
    "100.0%"
  );
  await expect(comparison.getByRole("row", { name: /准确率/ })).toContainText(
    "+100.0 pp"
  );
  await expect(results.getByLabel("查看 Judge 校准历史").locator("option"))
    .toHaveCount(2);

  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="Judge 校准运行"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  await page.reload();
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  const reloadedResults = page
    .getByLabel("Judge 校准运行")
    .getByLabel("Judge 校准结果");
  await expect(reloadedResults.getByLabel("Judge 校准前后对比")).toBeVisible();
  await expect(reloadedResults.getByLabel("查看 Judge 校准历史").locator("option"))
    .toHaveCount(2);
  expect(judgeCalls).toHaveLength(2);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await reloadedResults.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "docs/evidence/pr-06e/evaluator-rerun-comparison.png",
      fullPage: false,
    });
  }
});
