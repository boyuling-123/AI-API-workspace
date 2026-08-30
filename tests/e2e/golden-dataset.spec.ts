import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("imports, validates, versions, and locks a human golden dataset", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const apiCalls: string[] = [];
  await page.route("**/api/**", async (route) => {
    apiCalls.push(new URL(route.request().url()).pathname);
    await route.fulfill({
      body: JSON.stringify({ error: "Golden dataset flow must not call APIs" }),
      contentType: "application/json",
      status: 500,
    });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  await expect(
    page.getByRole("heading", { name: "人工黄金集" })
  ).toBeVisible();
  await expect(page.getByText("本轮 0 次 Judge 调用")).toBeVisible();

  const fileInput = page.getByLabel("导入黄金集文件");
  await fileInput.setInputFiles({
    name: "invalid-golden.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          case_id: "gold-001",
          prompt: "退款规则是什么",
          candidate_output: "所有商品都能退款",
        },
      ])
    ),
  });
  await expect(page.getByLabel("黄金集导入问题")).toContainText(
    "缺少必填列：人工标签"
  );
  await expect(
    page.getByRole("button", { name: "发布并锁定 v1" })
  ).toBeDisabled();
  await page.getByRole("button", { name: "+ 手工新增 Case" }).click();
  await expect(
    page.getByText(
      "当前导入仍有阻断问题。请修复源文件后重新导入，或先点击“新建黄金集”清空导入结果。"
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "发布并锁定 v1" })
  ).toBeDisabled();
  expect(apiCalls).toEqual([]);

  await fileInput.setInputFiles({
    name: "customer-service-golden.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          case_id: "gold-001",
          prompt: "退款规则是什么",
          candidate_output: "未拆封商品支持七天无理由退款",
          expected_answer: "未拆封商品支持七天无理由退款",
          human_label: "pass",
          human_score: 9,
          reviewer_note: "事实与规则一致",
        },
        {
          case_id: "gold-002",
          prompt: "能否承诺当天发货",
          candidate_output: "所有订单一定当天发货",
          expected_answer: "以商品页承诺时效为准",
          human_label: "fail",
          human_score: 2,
          reviewer_note: "存在过度承诺",
        },
      ])
    ),
  });
  const mapping = page.getByLabel("黄金集字段映射预览");
  await expect(mapping).toContainText("Case ID ← case_id");
  await expect(mapping).toContainText("候选输出 ← candidate_output");
  await expect(mapping).toContainText("人工标签 ← human_label");
  await expect(page.getByText("字段映射确认完成：2 条有效 Case，可继续人工核对。"))
    .toBeVisible();

  await page.getByLabel("黄金集名称").fill("客服上线黄金集");
  await page.getByLabel("黄金集标注负责人").fill("Lu");
  await page.getByRole("button", { name: "发布并锁定 v1" }).click();
  await expect(
    page.getByText("客服上线黄金集 v1 已发布并锁定 2 条人工标签。")
  ).toBeVisible();
  const library = page.getByLabel("黄金集版本库");
  await expect(library.getByText("1 个版本")).toBeVisible();
  await expect(library.getByText("标签已锁定")).toBeVisible();
  expect(apiCalls).toEqual([]);

  await library
    .getByRole("button", { name: "基于 v1 创建新版本" })
    .click();
  await expect(page.getByText("新版本草稿 v2")).toBeVisible();
  await page.getByLabel("人工标签 gold-001").selectOption("fail");
  await page
    .getByLabel("黄金集变更说明")
    .fill("业务复核后将 gold-001 修正为不通过");
  await page.getByRole("button", { name: "发布并锁定 v2" }).click();
  await expect(
    page.getByText("客服上线黄金集 v2 已发布并锁定 2 条人工标签。")
  ).toBeVisible();
  await expect(library.getByText("2 个版本")).toBeVisible();

  const versionSelect = library.getByLabel("查看黄金集版本");
  const v1Id = await versionSelect
    .locator("option")
    .filter({ hasText: "客服上线黄金集 v1" })
    .getAttribute("value");
  const v2Id = await versionSelect
    .locator("option")
    .filter({ hasText: "客服上线黄金集 v2" })
    .getAttribute("value");
  expect(v1Id).toBeTruthy();
  expect(v2Id).toBeTruthy();

  await versionSelect.selectOption(v1Id!);
  const lockedVersion = library.getByLabel("已锁定黄金集版本");
  await expect(
    lockedVersion.locator("div").filter({ hasText: "gold-001" }).getByText("通过", { exact: true }).first()
  ).toBeVisible();
  await versionSelect.selectOption(v2Id!);
  await expect(
    lockedVersion.locator("div").filter({ hasText: "gold-001" }).getByText("不通过", { exact: true }).first()
  ).toBeVisible();

  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Judge 校准/ }).click();
  const reloadedLibrary = page.getByLabel("黄金集版本库");
  await expect(reloadedLibrary.getByText("2 个版本")).toBeVisible();
  await reloadedLibrary.getByLabel("查看黄金集版本").selectOption(v1Id!);
  await expect(
    reloadedLibrary
      .getByLabel("已锁定黄金集版本")
      .locator("div")
      .filter({ hasText: "gold-001" })
      .getByText("通过", { exact: true })
      .first()
  ).toBeVisible();
  expect(apiCalls).toEqual([]);

  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="人工黄金集管理"]')
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
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.getByLabel("人工黄金集管理").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "docs/evidence/pr-06b/golden-dataset-versions.png",
      fullPage: false,
    });
  }
});
