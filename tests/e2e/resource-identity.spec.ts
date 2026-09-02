import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("manages resource identity and explicit connectivity status without background calls", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.route("**/api/**", async (route) => {
    apiRequests.push(`${route.request().method()} ${route.request().url()}`);
    if (new URL(route.request().url()).pathname === "/api/test-api") {
      await route.fulfill({
        body: JSON.stringify({
          ok: true,
          latencyMs: 18,
          extractedTextOk: true,
          extractedImageCount: 1,
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    await route.fulfill({
      body: JSON.stringify({ error: "E2E blocks unexpected API calls" }),
      contentType: "application/json",
      status: 503,
    });
  });

  await page.goto("/?tab=access");
  const pool = page.getByLabel("统一资源池");

  await pool.getByLabel("接入来源").selectOption("preset");
  await pool.getByLabel("有效状态").selectOption("tested_ok");
  await expect(pool.getByText("显示 4 / 4 个资源")).toBeVisible();
  await pool.getByLabel("搜索资源").fill("default-judge");
  await expect(pool.getByText("显示 1 / 4 个资源")).toBeVisible();
  await expect(
    pool.getByText("Qwen3.6 Plus（多模态 · 默认裁判）", { exact: true })
  ).toBeVisible();
  await pool.getByRole("button", { name: "清除筛选" }).click();
  expect(apiRequests).toEqual([]);

  const accessSection = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: /接口创建&管理/ }),
    })
    .last();
  const configItem = (name: string) =>
    accessSection.getByRole("listitem").filter({ hasText: name });

  await configItem("Mock 生图算法（内置样例）")
    .getByRole("button", { name: "编辑" })
    .click();
  await expect(page.getByLabel("资源版本")).toHaveValue("1.0.0");
  await expect(page.getByLabel("资源别名")).toHaveValue(
    "mock-image, image-main"
  );
  await page.getByLabel("资源版本").fill("1.1.0");
  await page
    .getByLabel("资源别名")
    .fill("mock-image, image-main, mock-image-v1");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  let mockCard = pool
    .getByRole("listitem")
    .filter({ hasText: "Mock 生图算法（内置样例）" });
  await expect(mockCard).toContainText("资源版本：1.1.0");
  await expect(mockCard).toContainText("mock-image-v1");
  await expect(
    mockCard.getByText("测试通过", { exact: true })
  ).toBeVisible();

  await configItem("Kimi K2.6（多模态）")
    .getByRole("button", { name: "编辑" })
    .click();
  await page.getByLabel("资源别名").fill("mock-image");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByText(
      "别名 mock-image 已被资源 Mock 生图算法（内置样例） 使用"
    )
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();

  await configItem("Mock 生图算法（内置样例）")
    .getByRole("button", { name: "编辑" })
    .click();
  await page.getByLabel("请求 URL").fill("/api/mock-algo-v2");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  mockCard = pool
    .getByRole("listitem")
    .filter({ hasText: "Mock 生图算法（内置样例）" });
  await expect(
    mockCard.getByText("未测试", { exact: true })
  ).toBeVisible();
  await pool.getByLabel("有效状态").selectOption("unverified");
  await expect(pool.getByText("显示 1 / 4 个资源")).toBeVisible();
  await pool.getByRole("button", { name: "清除筛选" }).click();
  expect(apiRequests).toEqual([]);

  await configItem("Mock 生图算法（内置样例）")
    .getByRole("button", { name: "编辑" })
    .click();
  await page.getByLabel("请求 URL").fill("/api/mock-algo");
  await page.getByRole("button", { name: "测试连通性" }).click();
  await expect(page.getByText(/通过：耗时 18ms/)).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();

  mockCard = pool
    .getByRole("listitem")
    .filter({ hasText: "Mock 生图算法（内置样例）" });
  await expect(
    mockCard.getByText("测试通过", { exact: true })
  ).toBeVisible();
  const statusTime = mockCard
    .locator("p")
    .filter({ hasText: "最近连通性测试：" });
  await expect(statusTime).not.toContainText("未记录");
  expect(apiRequests).toHaveLength(1);
  expect(apiRequests[0]).toMatch(/^POST .*\/api\/test-api$/);

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
    const dismissPet = page.getByRole("button", { name: "×", exact: true });
    if (await dismissPet.isVisible()) await dismissPet.click();
    await page.setViewportSize({ width: 1440, height: 1180 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: "docs/evidence/pr-08b/resource-identity-health.png",
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
  expect(browserErrors).toEqual([]);
});
