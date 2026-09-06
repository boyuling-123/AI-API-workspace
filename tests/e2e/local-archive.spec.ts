import { expect, test as base } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const test = base.extend<{ archiveGuard: void }>({
  archiveGuard: [async ({ page }, use) => {
    const unexpected: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!["localhost", "127.0.0.1"].includes(url.hostname) || (url.pathname.startsWith("/api/") && url.pathname !== "/api/local-archive")) {
        unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort();
      } else await route.fallback();
    });
    await use();
    expect(unexpected, "no remote, model, or unrelated API requests").toEqual([]);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

test("real local archive API drives bounded pages, scoped filters and privacy confirmation", async ({ page }) => {
  const bodies: string[] = [];
  page.on("request", (request) => { if (request.url().includes("action=content")) bodies.push(request.url()); });
  await page.goto("/history-demo");
  await expect(page.getByRole("heading", { name: "历史归档工作台", level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("只读连接完成");
  await expect(page.getByText("当前为合成测试夹具", { exact: false })).toBeVisible();
  await expect(page.getByText("发现旧清单汇总偏差", { exact: false })).toContainText("多 1 条");
  await expect(page.getByRole("row")).toHaveCount(51);
  await expect(page.locator("body")).not.toContainText("synthetic-private-model");
  await expect(page.locator("body")).not.toContainText("合成输入 1");
  expect(bodies).toHaveLength(0);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByText("第 2 / 2 页", { exact: false })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(13);
  await page.getByLabel("当前分片类别", { exact: true }).selectOption("失败记录");
  await expect(page.getByText("当前分片匹配 31 / 62 条", { exact: false })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(32);
  await expect(page.getByRole("cell", { name: "历史超时", exact: true })).toHaveCount(31);
  await page.getByLabel("当前分片类别", { exact: true }).selectOption("Judge 结果");
  await expect(page.getByText("当前分片没有符合条件的记录。")).toBeVisible();
  await page.getByLabel("分片", { exact: true }).selectOption("1");
  await expect(page.getByText("当前分片匹配 1 / 1 条", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "查看第 1 条索引正文" }).click();
  await expect(page.getByRole("dialog")).toContainText("正文可能包含业务或个人信息");
  expect(bodies).toHaveLength(0);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(bodies).toHaveLength(0);
  await page.getByLabel("当前分片类别", { exact: true }).selectOption("");
  await expect(page.getByRole("status")).toContainText("只读连接完成");
  await page.getByLabel("分片", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "查看第 1 条索引正文" }).click();
  await page.getByRole("button", { name: "我确认，只在本机查看此条" }).click();
  await expect(page.getByRole("dialog")).toContainText("合成输入 1 <script>not-executed</script>");
  await expect(page.getByRole("heading", { name: "模型输出（非标准答案）" })).toBeVisible();
  expect(bodies).toHaveLength(1);
  await expect(page.getByRole("dialog").locator("img,script")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.getByRole("button", { name: "关闭正文" }).click();
  await expect(page.locator("body")).not.toContainText("合成输入 1");
});

test("summary download has clear units and no raw records; overview and mobile work", async ({ page }) => {
  await page.goto("/?tab=overview");
  await page.getByRole("link", { name: "打开历史归档演示（只读）" }).click();
  await expect(page.getByRole("status")).toContainText("只读连接完成");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载统计摘要 JSON" }).click();
  const download = await event;
  const text = await readFile((await download.path())!, "utf8");
  const result = JSON.parse(text);
  expect(result).toMatchObject({ totalRecords: 63, uniqueRecordIds: 62, provenance: "synthetic", manifestCountDelta: 1,
    counts: { "跑批结果": 31, "失败记录": 31, "Judge 结果": 1 } });
  expect(result.definitions.totalRecords).toContain("不代表独立测试用例或模型调用次数");
  expect(text).not.toMatch(/synthetic-private-model|private\/source|合成输入|localhost/);
  expect(result).not.toHaveProperty("rows");
  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.getByLabel("分片", { exact: true }).selectOption("1");
    await expect(page.getByText("当前分片匹配 1 / 1 条", { exact: false })).toBeVisible();
    await page.screenshot({ path: "docs/evidence/pr-local-history-demo/local-history.png", fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.reload();
  await expect(page.getByRole("status")).toContainText("只读连接完成");
});

test("read errors have recovery and the real route blocks unconfirmed or cross-origin reads", async ({ page, request }) => {
  await page.route("**/api/local-archive?action=summary", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: false, error: "合成缺失配置：请连接本机目录。" }) }));
  await page.goto("/history-demo");
  await expect(page.getByRole("alert").filter({ hasText: "合成缺失配置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下载统计摘要 JSON" })).toBeDisabled();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.unroute("**/api/local-archive?action=summary");
  await page.getByRole("button", { name: "重试读取" }).click();
  await expect(page.getByRole("status")).toContainText("只读连接完成");
  expect((await request.get("/api/local-archive")).status()).toBe(403);
  expect((await request.get("/api/local-archive?action=content", { headers: { "x-eval-archive": "local-read" } })).status()).toBe(403);
  expect((await request.get("/api/local-archive", { headers: { "x-eval-archive": "local-read", origin: "https://invalid.example" } })).status()).toBe(403);
});
