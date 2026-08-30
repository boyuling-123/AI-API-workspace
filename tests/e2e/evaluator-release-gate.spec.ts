import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { structuredRubric } from "./fixtures/structuredRubric";

test("blocks a failing calibration and publishes a passing Evaluator without extra model calls", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const rubric = structuredRubric(
    "发布质量",
    "回复必须准确、完整并满足正式发布要求"
  );
  const judgeCalls: Record<string, unknown>[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outputText: "Mock release candidate",
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
        body: JSON.stringify({ evalPrompt: "第一版 Prompt：判断是否可以发布。" }),
      });
      return;
    }
    if (pathname === "/api/judge-calibration") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      judgeCalls.push(body);
      const item = body.item as { caseId: string };
      const caseNumber = Number(item.caseId.split("-").at(-1));
      const humanLabel = caseNumber <= 10 ? "pass" : "fail";
      const improved = String(body.criteria).includes("第二版 Prompt");
      const judgeLabel =
        !improved && item.caseId === "release-011" ? "pass" : humanLabel;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          caseId: item.caseId,
          judgeLabel,
          confidence: improved ? 0.98 : 0.91,
          reason:
            judgeLabel === humanLabel
              ? "与人工发布标准一致"
              : "错误放行一个 Bad Case",
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
  await inputSection.locator("tbody tr input").first().fill("检查发布候选回复");
  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.getByRole("button", { name: "运行", exact: true }))
    .toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("判断回复能否正式发布");
  await page.getByLabel("业务场景").fill("发布前质量验收");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 发布质量").check();
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page.getByRole("button", { name: "按维度自动生成评价 Prompt" }).click();

  const versionPanel = page.getByLabel("Evaluator 版本管理");
  await versionPanel.getByLabel("Evaluator 名称").fill("发布评价器");
  await versionPanel.getByLabel("Evaluator 修改人").fill("Lu");
  await versionPanel.getByLabel("Evaluator 变更说明").fill("建立发布门禁基线");
  await versionPanel.getByRole("button", { name: "保存为 Evaluator v1" }).click();
  const versionSelect = versionPanel.getByLabel("加载 Evaluator 版本");
  const v1Id = await versionSelect
    .locator("option")
    .filter({ hasText: "发布评价器 v1" })
    .getAttribute("value");
  expect(v1Id).toBeTruthy();

  await page
    .getByLabel("评价 Prompt")
    .fill("第二版 Prompt：先排除风险，再判断是否可以发布。");
  await versionPanel.getByLabel("Evaluator 变更说明").fill("增加风险拦截顺序");
  await versionPanel.getByRole("button", { name: "保存为新版本 v2" }).click();
  const v2Id = await versionSelect
    .locator("option")
    .filter({ hasText: "发布评价器 v2" })
    .getAttribute("value");
  expect(v2Id).toBeTruthy();

  const goldenRows = Array.from({ length: 20 }, (_, index) => ({
    case_id: `release-${String(index + 1).padStart(3, "0")}`,
    prompt: `发布检查 ${index + 1}`,
    candidate_output: `候选回复 ${index + 1}`,
    expected_answer: `参考回复 ${index + 1}`,
    human_label: index < 10 ? "pass" : "fail",
    reviewer_note: index < 10 ? "人工确认可发布" : "人工确认需拦截",
  }));

  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  await page.getByLabel("导入黄金集文件").setInputFiles({
    name: "release-golden.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(goldenRows)),
  });
  await page.getByLabel("黄金集名称").fill("发布门禁黄金集");
  await page.getByLabel("黄金集标注负责人").fill("Lu");
  await page.getByRole("button", { name: "发布并锁定 v1" }).click();

  const calibration = page.getByLabel("Judge 校准运行");
  const releaseGate = calibration.getByLabel("Evaluator Active 发布门禁");
  await calibration.getByLabel("校准 Evaluator 版本").selectOption(v1Id!);
  await calibration.getByRole("button", { name: "预览并启动校准" }).click();
  await page
    .getByRole("dialog", { name: "确认启动 Judge 校准" })
    .getByRole("button", { name: "确认并调用 20 次 Judge" })
    .click();
  await expect(calibration.getByText("校准完成：成功 20 条，失败 0 条。"))
    .toBeVisible();
  expect(judgeCalls).toHaveLength(20);

  await expect(releaseGate.getByText("禁止发布", { exact: true })).toBeVisible();
  await expect(releaseGate.getByText("10.0%", { exact: true })).toBeVisible();
  await expect(releaseGate.getByText("≤ 5.0%", { exact: true })).toBeVisible();
  await expect(
    releaseGate.getByRole("button", { name: "确认发布为 Active" })
  ).toBeDisabled();

  await calibration.getByLabel("校准 Evaluator 版本").selectOption(v2Id!);
  await calibration.getByRole("button", { name: "预览并启动重跑" }).click();
  expect(judgeCalls).toHaveLength(20);
  await page
    .getByRole("dialog", { name: "确认启动 Judge 校准" })
    .getByRole("button", { name: "确认并调用 20 次 Judge" })
    .click();
  await expect(calibration.getByText("重跑完成：成功 20 条，失败 0 条。"))
    .toBeVisible();
  expect(judgeCalls).toHaveLength(40);

  await expect(releaseGate.getByText("全部门禁通过", { exact: true }))
    .toBeVisible();
  await expect(releaseGate.getByText("0.0%", { exact: true })).toBeVisible();
  await releaseGate.getByLabel("Evaluator 发布人").fill("Lu");
  await releaseGate
    .getByRole("button", { name: "确认发布为 Active" })
    .click();
  const releaseDialog = page.getByRole("dialog", {
    name: "确认发布 Evaluator 为 Active",
  });
  await expect(releaseDialog).toBeVisible();
  await expect(releaseDialog.getByText("0 次", { exact: true })).toBeVisible();
  expect(judgeCalls).toHaveLength(40);
  await releaseDialog
    .getByRole("button", { name: "确认发布为 Active" })
    .click();
  await expect(releaseGate.getByText("发布评价器 v2 已发布为 Active。"))
    .toBeVisible();
  await expect(
    releaseGate.getByText("当前 Active").locator("..").getByText(/发布评价器 v2 · Lu/)
  ).toBeVisible();
  expect(judgeCalls).toHaveLength(40);

  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="Evaluator Active 发布门禁"]')
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
  const reloadedGate = page
    .getByLabel("Judge 校准运行")
    .getByLabel("Evaluator Active 发布门禁");
  await expect(
    reloadedGate.getByText("当前 Active").locator("..").getByText(/发布评价器 v2 · Lu/)
  ).toBeVisible();
  await expect(reloadedGate.getByText("发布历史", { exact: true })).toBeVisible();
  expect(judgeCalls).toHaveLength(40);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await reloadedGate.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "docs/evidence/pr-06f/evaluator-release-gate.png",
      fullPage: false,
    });
  }
});
