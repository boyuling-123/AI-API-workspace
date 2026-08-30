import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("claims, reviews and persists a risky multi-Judge Case without new model calls", async ({
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
      item.caseId === "review-001" && modelId === "qwen3.6-plus"
        ? "fail"
        : item.caseId === "review-001"
          ? "pass"
          : "fail";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        caseId: item.caseId,
        judgeLabel,
        confidence: 0.9,
        reason: `${modelId} 独立判断为 ${judgeLabel}`,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  await page.getByLabel("导入黄金集文件").setInputFiles({
    name: "review-golden.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          case_id: "review-001",
          prompt: "未拆封商品是否支持七天退款",
          candidate_output: "未拆封商品支持七天退款",
          human_label: "pass",
        },
        {
          case_id: "review-002",
          prompt: "是否保证所有订单当天发货",
          candidate_output: "所有订单一定当天发货",
          human_label: "fail",
        },
      ])
    ),
  });
  await page.getByLabel("黄金集名称").fill("复核队列黄金集");
  await page.getByLabel("黄金集标注负责人").fill("Lu");
  await page.getByRole("button", { name: "发布并锁定 v1" }).click();

  const calibration = page.getByLabel("Judge 校准运行");
  const configuration = calibration.getByLabel("Judge 校准配置");
  await configuration.getByRole("button", { name: "多 Judge", exact: true }).click();
  await configuration.getByLabel("选择 Judge DeepSeek V4 Pro").check();
  await configuration.getByLabel("选择 Judge Kimi K2.6（多模态）").check();
  await configuration
    .getByLabel("选择 Judge Qwen3.6 Plus（多模态 · 默认裁判）")
    .check();
  await configuration.getByRole("button", { name: "预览并启动校准" }).click();
  await page
    .getByRole("dialog", { name: "确认启动 Judge 校准" })
    .getByRole("button", { name: "确认并调用 6 次 Judge" })
    .click();
  await expect(
    calibration.getByText(
      "多 Judge 校准完成：Case 成功 2 条，失败 0 条，共调用 6 次。"
    )
  ).toBeVisible();
  expect(judgeCalls).toHaveLength(6);
  expect(unexpectedApiCalls).toEqual([]);

  const reviewQueue = calibration.getByLabel("校准人工复核队列");
  await expect(reviewQueue.getByText("待处理 1 条", { exact: true })).toBeVisible();
  await expect(reviewQueue.getByText("0 次模型调用", { exact: true })).toBeVisible();
  await expect(reviewQueue.getByText("风险 Case").locator("..").getByText("1", { exact: true })).toBeVisible();

  const item = reviewQueue.getByLabel("review-001 校准复核");
  await expect(item.getByText("高风险 · 80", { exact: true })).toBeVisible();
  await expect(item.getByText("多 Judge 内部分歧 +55", { exact: true })).toBeVisible();
  await expect(item.getByText("低置信度 +25", { exact: true })).toBeVisible();
  await expect(item.getByText("人工 pass / Judge pass", { exact: true })).toBeVisible();

  await reviewQueue.getByLabel("校准复核风险筛选").selectOption("errors");
  await expect(reviewQueue.getByText("当前筛选没有匹配 Case", { exact: true })).toBeVisible();
  await reviewQueue.getByRole("button", { name: "清除筛选" }).click();

  await reviewQueue.getByLabel("校准复核人").fill("Lu");
  await item.getByRole("button", { name: "领取复核" }).click();
  await expect(reviewQueue.getByText("review-001 已由 Lu 领取。", { exact: true })).toBeVisible();
  await expect(item.getByText("复核中", { exact: true })).toBeVisible();
  const completeButton = item.getByRole("button", { name: "完成复核" });
  await expect(completeButton).toBeDisabled();
  await item.getByLabel("review-001 复核结论").selectOption("override_fail");
  await item
    .getByLabel("review-001 复核说明")
    .fill("三位 Judge 存在分歧，按售后政策人工改判为 fail。");
  await expect(completeButton).toBeEnabled();
  await completeButton.click();

  await expect(
    reviewQueue.getByText(
      "review-001 已完成复核；原始 Judge 结论保持不变。",
      { exact: true }
    )
  ).toBeVisible();
  await reviewQueue.getByLabel("校准复核状态筛选").selectOption("completed");
  await expect(item.getByText("已完成", { exact: true })).toBeVisible();
  await expect(item.getByText("人工改判为 fail", { exact: true })).toBeVisible();
  await expect(
    item.getByText("人工复核层：fail；原始 Judge pass 保持不变。", {
      exact: true,
    })
  ).toBeVisible();
  const audit = item.getByLabel("review-001 复核审计记录");
  await audit.locator("summary").click();
  await expect(audit.getByText(/Lu 领取/)).toBeVisible();
  await expect(audit.getByText(/Lu 完成：人工改判为 fail/)).toBeVisible();
  expect(judgeCalls).toHaveLength(6);

  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="校准人工复核队列"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  const reloadedQueue = page
    .getByLabel("Judge 校准运行")
    .getByLabel("校准人工复核队列");
  await expect(reloadedQueue.getByText("已完成").locator("..").getByText("1", { exact: true })).toBeVisible();
  await reloadedQueue.getByLabel("校准复核状态筛选").selectOption("completed");
  const reloadedItem = reloadedQueue.getByLabel("review-001 校准复核");
  await expect(reloadedItem.getByText("人工改判为 fail", { exact: true })).toBeVisible();
  await expect(
    reloadedItem.getByText("人工 pass / Judge pass", { exact: true })
  ).toBeVisible();
  expect(judgeCalls).toHaveLength(6);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await reloadedItem.getByLabel("review-001 复核审计记录").locator("summary").click();
    await reloadedQueue.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "docs/evidence/pr-07a/calibration-review-queue.png",
      fullPage: false,
    });
    expect(judgeCalls).toHaveLength(6);
  }
});
