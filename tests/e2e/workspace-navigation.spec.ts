import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("uses entity navigation and a single page title, not the legacy global tabs", async ({ page, safePage }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("评测任务");
  await expect(page.getByRole("navigation", { name: "页面二级导航" }).getByRole("link", { name: "运行记录" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("tablist", { name: "工作区功能导航" })).toHaveCount(0);
  for (const name of ["评测集", "评测对象", "评估器", "评测任务", "评测报告", "管理中心"]) {
    await expect(page.getByRole("navigation", { name: "工作区主导航" }).getByRole("link", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "新建评测任务", exact: true }).click();
  await expect(page).toHaveURL(/tab=run/);
  await expect(page.getByText("批量运行控制台", { exact: true })).toBeVisible();
  expect(safePage.apiRequests).toEqual([]);
});

test("entity navigation keeps the input draft and supports back, forward and reload", async ({ page }) => {
  await page.goto("/?tab=dataset");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("评测集");
  const editor = page.getByPlaceholder("输入 prompt...");
  await editor.fill("只用于导航验收的合成输入");
  await page.getByRole("button", { name: "新建评测任务" }).click();
  await expect(editor).toHaveValue("只用于导航验收的合成输入");
  await page.getByRole("link", { name: "评测对象", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("评测对象");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("评测任务");
  await expect(editor).toHaveValue("只用于导航验收的合成输入");
  await page.goForward();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("评测对象");
});

test("legacy import links remain explicit and never start a model", async ({ page, safePage }) => {
  await page.goto("/?tab=run&draft_id=demo_draft&mode=reference&content_mode=text");
  await expect(page.getByRole("button", { name: "批量导入" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "文生成类" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "评测集", exact: true }).click();
  await expect(page).toHaveURL(/draft_id=demo_draft/);
  await expect(page.getByText(/DatasetVersion、row_id 哈希与版本 Diff 尚未实现/)).toBeVisible();
  expect(safePage.apiRequests).toEqual([]);
});

test("management isolates external capabilities and direct evaluation explains its source", async ({ page }) => {
  await page.goto("/?tab=integrations");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("管理中心");
  for (const route of ["import-dataset", "import-target", "judge-reference", "run-batch"]) {
    await expect(page.getByText(`规划路由 · /api/${route}`, { exact: true })).toBeVisible();
  }
  await page.goto("/?tab=evaluate");
  await expect(page.getByText("请在「评测任务 / 运行记录」选择批次，再点击「去AI评测」。")).toBeVisible();
  await page.getByRole("button", { name: "返回运行记录", exact: true }).last().click();
  await expect(page).toHaveURL(/tab=result/);
});

test("unknown pages fall back to run records without reflecting the query", async ({ page }) => {
  await page.goto("/?tab=unknown-synthetic-page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("评测任务");
  await expect(page.getByRole("link", { name: "运行记录", exact: true })).toHaveAttribute("aria-current", "page");
});

for (const tab of ["result", "dataset", "access", "integrations"]) {
  test(`${tab}: desktop and mobile page hierarchy remains accessible`, async ({ page }) => {
    await page.goto(`/?tab=${tab}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (process.env.CAPTURE_NAV_EVIDENCE === "1") await page.screenshot({ path: `docs/evidence/pr-workspace-navigation/${tab}-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "展开导航" }).click();
    await expect(page.getByRole("link", { name: "评测集", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "评测集", exact: true }).click();
    await expect(page.getByRole("button", { name: "展开导航" })).toBeVisible();
    await page.goto(`/?tab=${tab}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
    if (process.env.CAPTURE_NAV_EVIDENCE === "1") await page.screenshot({ path: `docs/evidence/pr-workspace-navigation/${tab}-mobile.png`, fullPage: true });
  });
}
