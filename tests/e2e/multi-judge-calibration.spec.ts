import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("confirms a Case by Judge matrix and preserves every raw vote", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const judgeCalls: Record<string, unknown>[] = [];
  const unexpectedApiCalls: string[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname !== "/api/judge-calibration") {
      unexpectedApiCalls.push(pathname);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: `Unexpected API call: ${pathname}` }),
      });
      return;
    }

    const body = route.request().postDataJSON() as Record<string, unknown>;
    judgeCalls.push(body);
    const item = body.item as { caseId: string };
    const modelId = String(body.modelId);
    const judgeLabel =
      item.caseId === "multi-001" && modelId === "qwen3.6-plus"
        ? "fail"
        : item.caseId === "multi-001"
          ? "pass"
          : "fail";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        caseId: item.caseId,
        judgeLabel,
        confidence: modelId === "qwen3.6-plus" ? 0.74 : 0.96,
        reason: `${modelId} 独立判断为 ${judgeLabel}`,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  await page.getByLabel("导入黄金集文件").setInputFiles({
    name: "multi-judge-golden.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          case_id: "multi-001",
          prompt: "未拆封商品是否支持七天退款",
          candidate_output: "未拆封商品支持七天退款",
          expected_answer: "未拆封商品支持七天退款",
          human_label: "pass",
          reviewer_note: "人工确认正确，不得发送给 Judge",
        },
        {
          case_id: "multi-002",
          prompt: "是否保证所有订单当天发货",
          candidate_output: "所有订单一定当天发货",
          expected_answer: "以商品页承诺时效为准",
          human_label: "fail",
          reviewer_note: "人工确认属于过度承诺",
        },
      ])
    ),
  });
  await page.getByLabel("黄金集名称").fill("多 Judge 校准黄金集");
  await page.getByLabel("黄金集标注负责人").fill("Lu");
  await page.getByRole("button", { name: "发布并锁定 v1" }).click();

  const calibration = page.getByLabel("Judge 校准运行");
  const configuration = calibration.getByLabel("Judge 校准配置");
  const startButton = configuration.getByRole("button", {
    name: "预览并启动校准",
  });
  await expect(calibration.getByText("预览 2 次 Judge 调用")).toBeVisible();
  await configuration.getByRole("button", { name: "多 Judge", exact: true }).click();
  await expect(calibration.getByText("预览 0 次 Judge 调用")).toBeVisible();
  await expect(startButton).toBeDisabled();

  await configuration.getByLabel("选择 Judge DeepSeek V4 Pro").check();
  await expect(
    configuration.getByText("2 Case × 1 Judge = 2 次调用", { exact: true })
  ).toBeVisible();
  await expect(startButton).toBeDisabled();
  await configuration
    .getByLabel("选择 Judge Kimi K2.6（多模态）")
    .check();
  await expect(startButton).toBeEnabled();
  await configuration
    .getByLabel("选择 Judge Qwen3.6 Plus（多模态 · 默认裁判）")
    .check();
  await expect(calibration.getByText("预览 6 次 Judge 调用")).toBeVisible();
  await expect(
    configuration.getByText("2 Case × 3 Judge = 6 次调用", { exact: true })
  ).toBeVisible();

  const strategy = configuration.getByLabel("多 Judge 仲裁策略");
  await strategy.selectOption("unanimous_pass");
  await expect(
    configuration.getByText(/只有全部 Judge 都判为 pass 才通过/)
  ).toBeVisible();
  await strategy.selectOption("majority_conservative");
  await expect(
    configuration.getByText(/票数相同时固定判为 fail/)
  ).toBeVisible();

  const configurationAccessibility = await new AxeBuilder({ page })
    .include('[aria-label="Judge 校准配置"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    configurationAccessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  await startButton.click();
  const dialog = page.getByRole("dialog", { name: "确认启动 Judge 校准" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("6 次", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("2 Case × 3 Judge = 6", { exact: true })
  ).toBeVisible();
  await expect(dialog.getByText("多 Judge 独立投票", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("多数票（平票保守 fail）", { exact: true })
  ).toBeVisible();
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
  expect(judgeCalls).toEqual([]);
  await startButton.click();
  await page
    .getByRole("dialog", { name: "确认启动 Judge 校准" })
    .getByRole("button", { name: "确认并调用 6 次 Judge" })
    .click();
  await expect(
    calibration.getByText(
      "多 Judge 校准完成：Case 成功 2 条，失败 0 条，共调用 6 次。"
    )
  ).toBeVisible();

  expect(unexpectedApiCalls).toEqual([]);
  expect(judgeCalls).toHaveLength(6);
  const actualMatrix = judgeCalls
    .map((call) => {
      const item = call.item as Record<string, unknown>;
      expect(Object.keys(item).sort()).toEqual([
        "candidateOutput",
        "caseId",
        "expectedAnswer",
        "prompt",
      ]);
      expect(item).not.toHaveProperty("humanLabel");
      expect(item).not.toHaveProperty("reviewerNote");
      return `${String(item.caseId)}:${String(call.modelId)}`;
    })
    .sort();
  expect(actualMatrix).toEqual(
    ["multi-001", "multi-002"]
      .flatMap((caseId) =>
        ["deepseek-v4-pro", "kimi-k2.6", "qwen3.6-plus"].map(
          (modelId) => `${caseId}:${modelId}`
        )
      )
      .sort()
  );

  const results = calibration.getByLabel("Judge 校准结果");
  await expect(results.getByText("6 次调用", { exact: true })).toBeVisible();
  await expect(
    results.getByText("多数票（平票保守 fail）", { exact: true })
  ).toBeVisible();
  await expect(results.getByText("Judge 内部分歧 1 条", { exact: true }))
    .toBeVisible();
  const qwenMetrics = results.getByLabel(
    "Qwen3.6 Plus（多模态 · 默认裁判） 校准指标"
  );
  await expect(qwenMetrics.getByText("50.0%", { exact: true })).toBeVisible();
  await expect(qwenMetrics.getByText("成功 / 失败 2 / 0", { exact: true }))
    .toBeVisible();

  const disagreement = results.locator("article").filter({
    hasText: "multi-001",
  });
  await expect(
    disagreement.getByText("Judge 内部分歧 · 仲裁 pass · 人工 pass", {
      exact: true,
    })
  ).toBeVisible();
  const rawVotes = disagreement.getByLabel("multi-001 原始 Judge 投票");
  await rawVotes.locator("summary").click();
  await expect(rawVotes.getByText("DeepSeek V4 Pro", { exact: true })).toBeVisible();
  await expect(rawVotes.getByText("Kimi K2.6（多模态）", { exact: true }))
    .toBeVisible();
  await expect(
    rawVotes.getByText("Qwen3.6 Plus（多模态 · 默认裁判）", { exact: true })
  ).toBeVisible();
  await expect(rawVotes.getByText("qwen3.6-plus 独立判断为 fail", { exact: true }))
    .toBeVisible();

  const resultsAccessibility = await new AxeBuilder({ page })
    .include('[aria-label="Judge 校准结果"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    resultsAccessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  const reloadedResults = page
    .getByLabel("Judge 校准运行")
    .getByLabel("Judge 校准结果");
  await expect(reloadedResults.getByText("6 次调用", { exact: true }))
    .toBeVisible();
  await expect(reloadedResults.getByLabel(
    "Qwen3.6 Plus（多模态 · 默认裁判） 校准指标"
  )).toBeVisible();
  await expect(reloadedResults.getByText("Judge 内部分歧 1 条", { exact: true }))
    .toBeVisible();
  expect(judgeCalls).toHaveLength(6);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1200 });
    const reloadedCalibration = page.getByLabel("Judge 校准运行");
    const reloadedConfiguration = reloadedCalibration.getByLabel(
      "Judge 校准配置"
    );
    await reloadedConfiguration
      .getByRole("button", { name: "多 Judge", exact: true })
      .click();
    await reloadedConfiguration.getByLabel("选择 Judge DeepSeek V4 Pro").check();
    await reloadedConfiguration
      .getByLabel("选择 Judge Kimi K2.6（多模态）")
      .check();
    await reloadedConfiguration
      .getByLabel("选择 Judge Qwen3.6 Plus（多模态 · 默认裁判）")
      .check();
    await reloadedResults
      .getByLabel("multi-001 原始 Judge 投票")
      .locator("summary")
      .click();
    await reloadedResults.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "docs/evidence/pr-06h/multi-judge-calibration.png",
      fullPage: false,
    });
    expect(judgeCalls).toHaveLength(6);
  }
});
