import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("confirms exact Judge calls and drills into calibration disagreements", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const judgeCalls: Record<string, unknown>[] = [];
  const unexpectedApiCalls: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/judge-calibration") {
      unexpectedApiCalls.push(path);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unexpected API call" }),
      });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    judgeCalls.push(body);
    const item = body.item as { caseId: string };
    if (item.caseId === "gold-003") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Mock Judge timeout" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        caseId: item.caseId,
        judgeLabel: "pass",
        confidence: item.caseId === "gold-001" ? 0.95 : 0.72,
        reason:
          item.caseId === "gold-001"
            ? "与标准答案一致"
            : "错误地认为候选输出可通过",
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  const fileInput = page.getByLabel("导入黄金集文件");
  await fileInput.setInputFiles({
    name: "calibration-golden.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          case_id: "gold-001",
          prompt: "退款规则是什么",
          candidate_output: "未拆封商品支持七天退款",
          expected_answer: "未拆封商品支持七天退款",
          human_label: "pass",
          reviewer_note: "人工通过依据",
        },
        {
          case_id: "gold-002",
          prompt: "能否保证当天发货",
          candidate_output: "所有订单一定当天发货",
          expected_answer: "以商品页承诺时效为准",
          human_label: "fail",
          reviewer_note: "过度承诺",
        },
        {
          case_id: "gold-003",
          prompt: "能否无条件退款",
          candidate_output: "任何商品都能无条件退款",
          expected_answer: "需满足售后规则",
          human_label: "fail",
          reviewer_note: "接口失败路径",
        },
      ])
    ),
  });
  await page.getByLabel("黄金集名称").fill("客服校准黄金集");
  await page.getByLabel("黄金集标注负责人").fill("Lu");
  await page.getByRole("button", { name: "发布并锁定 v1" }).click();
  await expect(
    page.getByText("客服校准黄金集 v1 已发布并锁定 3 条人工标签。")
  ).toBeVisible();

  const calibration = page.getByLabel("Judge 校准运行");
  await expect(calibration.getByText("预览 3 次 Judge 调用")).toBeVisible();
  await expect(calibration.getByText("0 次被测模型调用")).toBeVisible();
  await calibration.getByRole("button", { name: "预览并启动校准" }).click();
  const dialog = page.getByRole("dialog", { name: "确认启动 Judge 校准" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("3 次", { exact: true })).toBeVisible();
  await expect(dialog.getByText("0 次", { exact: true })).toBeVisible();
  expect(judgeCalls).toEqual([]);

  const dialogAccessibility = await new AxeBuilder({ page })
    .include('[aria-label="确认启动 Judge 校准"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    dialogAccessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toBeHidden();
  expect(judgeCalls).toEqual([]);

  await calibration.getByRole("button", { name: "预览并启动校准" }).click();
  await page
    .getByRole("dialog", { name: "确认启动 Judge 校准" })
    .getByRole("button", { name: "确认并调用 3 次 Judge" })
    .click();
  await expect(
    calibration.getByText("校准完成：成功 2 条，失败 1 条。")
  ).toBeVisible();
  expect(judgeCalls).toHaveLength(3);
  expect(unexpectedApiCalls).toEqual([]);
  for (const call of judgeCalls) {
    const item = call.item as Record<string, unknown>;
    expect(Object.keys(item).sort()).toEqual([
      "candidateOutput",
      "caseId",
      "expectedAnswer",
      "prompt",
    ]);
    expect(item).not.toHaveProperty("humanLabel");
    expect(item).not.toHaveProperty("reviewerNote");
  }

  const results = page.getByLabel("Judge 校准结果");
  await expect(results.getByText("50.0%", { exact: true })).toBeVisible();
  await expect(results.getByText("0.000", { exact: true })).toBeVisible();
  await expect(results.getByText("100.0%", { exact: true })).toBeVisible();
  await expect(results.getByText("2 / 1", { exact: true })).toBeVisible();
  await expect(results.getByText("gold-002", { exact: true })).toBeVisible();
  await expect(results.getByText("人工 fail / Judge pass")).toBeVisible();
  await expect(results.getByText("gold-003", { exact: true })).toBeVisible();
  await expect(results.getByText("Mock Judge timeout")).toBeVisible();

  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  const reloadedResults = page.getByLabel("Judge 校准结果");
  await expect(reloadedResults.getByText("50.0%", { exact: true })).toBeVisible();
  await expect(reloadedResults.getByText("gold-002", { exact: true })).toBeVisible();
  expect(judgeCalls).toHaveLength(3);

  const pageAccessibility = await new AxeBuilder({ page })
    .include('[aria-label="Judge 校准运行"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    pageAccessibility.violations
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
    await results.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "docs/evidence/pr-06d/judge-calibration-results.png",
      fullPage: false,
    });
  }
});

test("requires typed confirmation for 100 or more Judge calls", async ({
  page,
}) => {
  const apiCalls: string[] = [];
  await page.route("**/api/**", async (route) => {
    apiCalls.push(new URL(route.request().url()).pathname);
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Large-run guard must block calls" }),
    });
  });
  const rows = Array.from({ length: 100 }, (_, index) => ({
    case_id: `large-${String(index + 1).padStart(3, "0")}`,
    prompt: `问题 ${index + 1}`,
    candidate_output: `候选输出 ${index + 1}`,
    human_label: index % 2 === 0 ? "pass" : "fail",
  }));

  await page.goto("/");
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  await page.getByLabel("导入黄金集文件").setInputFiles({
    name: "large-golden.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(rows)),
  });
  await page.getByLabel("黄金集名称").fill("百条校准黄金集");
  await page.getByRole("button", { name: "发布并锁定 v1" }).click();
  const calibration = page.getByLabel("Judge 校准运行");
  await expect(calibration.getByText("预览 100 次 Judge 调用")).toBeVisible();
  await calibration.getByRole("button", { name: "预览并启动校准" }).click();

  const dialog = page.getByRole("dialog", { name: "确认启动 Judge 校准" });
  const confirm = dialog.getByRole("button", {
    name: "确认并调用 100 次 Judge",
  });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("大批量校准调用数确认").fill("99");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("大批量校准调用数确认").fill("100");
  await expect(confirm).toBeEnabled();
  await dialog.getByRole("button", { name: "取消" }).click();
  expect(apiCalls).toEqual([]);
});
