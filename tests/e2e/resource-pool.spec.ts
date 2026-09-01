import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("filters and edits the unified resource pool without calling models", async ({
  page,
  safePage,
}) => {
  await page.goto("/?tab=access");
  const pool = page.getByLabel("统一资源池");

  await expect(
    pool.getByRole("heading", {
      name: "模型、算法与 Judge 统一资源池",
    })
  ).toBeVisible();
  await expect(pool.getByText("显示 4 / 4 个资源")).toBeVisible();
  await expect(pool.getByText("DeepSeek V4 Pro", { exact: true })).toBeVisible();
  await expect(
    pool.getByText("Mock 生图算法（内置样例）", { exact: true })
  ).toBeVisible();
  expect(safePage.apiRequests).toEqual([]);

  await pool.getByLabel("使用角色").selectOption("judge");
  await expect(pool.getByText("显示 3 / 4 个资源")).toBeVisible();
  await expect(
    pool.getByText("Mock 生图算法（内置样例）", { exact: true })
  ).toBeHidden();

  await pool.getByLabel("使用角色").selectOption("all");
  await pool.getByLabel("能力").selectOption("text_to_image");
  await expect(pool.getByText("显示 1 / 4 个资源")).toBeVisible();
  await expect(
    pool.getByText("num_images · number · 可选 · 默认 1 · 1–8", {
      exact: true,
    })
  ).toBeVisible();

  await pool.getByLabel("搜索资源").fill("不存在的资源");
  await expect(pool.getByText("没有符合当前条件的资源")).toBeVisible();
  await pool.getByRole("button", { name: "清除筛选" }).click();
  await expect(pool.getByText("显示 4 / 4 个资源")).toBeVisible();

  const accessSection = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: /接口创建&管理/ }),
    })
    .last();
  const mockConfig = accessSection
    .getByRole("listitem")
    .filter({ hasText: "Mock 生图算法（内置样例）" });
  await mockConfig.getByRole("button", { name: "编辑" }).click();

  await expect(page.getByLabel("资源类型", { exact: true })).toHaveValue(
    "algorithm"
  );
  await expect(
    page.getByRole("checkbox", { name: "文生图", exact: true })
  ).toBeChecked();
  await expect(page.getByLabel("num_images 最小值")).toHaveValue("1");
  await expect(page.getByLabel("num_images 最大值")).toHaveValue("8");
  await expect(page.getByLabel("num_images 默认值")).toHaveValue("1");
  await page.getByLabel("num_images 最小值").fill("9");
  await page
    .getByRole("checkbox", { name: "业务算法", exact: true })
    .check();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("num_images 的最小值不能大于最大值")).toBeVisible();
  await page.getByLabel("num_images 最小值").fill("2");
  await page.getByLabel("num_images 默认值").fill("9");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByText("num_images 的默认值必须位于参数范围内")
  ).toBeVisible();
  await page.getByLabel("num_images 默认值").fill("4");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await pool.getByLabel("能力").selectOption("business_algorithm");
  await expect(pool.getByText("显示 1 / 4 个资源")).toBeVisible();
  await expect(
    pool.getByText("num_images · number · 可选 · 默认 4 · 2–8", {
      exact: true,
    })
  ).toBeVisible();
  expect(safePage.apiRequests).toEqual([]);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await pool.getByLabel("能力").selectOption("all");
    const dismissPet = page.getByRole("button", { name: "×", exact: true });
    if (await dismissPet.isVisible()) await dismissPet.click();
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: "docs/evidence/pr-08a/resource-pool.png",
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true);
  expect(safePage.apiRequests).toEqual([]);
});
