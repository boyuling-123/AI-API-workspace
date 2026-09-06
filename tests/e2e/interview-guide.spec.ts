import { expect, test as base } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { renderInterviewGuide } from "../../src/lib/interviewGuide";

const test = base.extend<{ guideGuard: void }>({
  guideGuard: [async ({ page }, use) => {
    const unexpected: string[] = [], errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const indexRead = new URL(page.url()).pathname === "/history-demo"
        && url.pathname === "/api/local-archive" && route.request().method() === "GET"
        && ["summary", "page"].includes(url.searchParams.get("action") ?? "");
      if (!["localhost", "127.0.0.1"].includes(url.hostname) || (url.pathname.startsWith("/api/") && !indexRead)) {
        unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort();
      } else await route.fallback();
    });
    await use();
    expect(unexpected, "guide has no API calls; only explicit archive navigation may read indices, never bodies or models").toEqual([]);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

test("overview opens Chinese guide and chapters survive refresh without implicit tasks", async ({ page }) => {
  await page.goto("/?tab=overview");
  await page.getByRole("link", { name: "面试演示导览", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "评测工作台演示导览" })).toBeVisible();
  await page.getByRole("link", { name: "打开平台总览", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=overview$/);
  await page.getByRole("link", { name: "面试演示导览", exact: true }).click();
  await page.getByRole("link", { name: "下一章：历史规模", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "演示章节" }).getByRole("link", { name: /历史规模/ })).toHaveAttribute("aria-current", "step");
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "先解释数据是什么，再展示有多少条。" })).toBeVisible();
  await expect(page.getByText("点击后将读取已配置归档的索引摘要与首屏分页", { exact: false })).toBeVisible();
});

test("explicit archive navigation reads only indices and returns to the history chapter", async ({ page }) => {
  await page.goto("/interview-demo?chapter=history");
  const summary = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/local-archive"
    && new URL(response.url()).searchParams.get("action") === "summary");
  await page.getByRole("link", { name: "打开本机归档", exact: true }).click();
  expect((await summary).status()).toBe(200);
  await expect(page.getByRole("status")).toContainText("只读连接完成");
  await expect(page.getByRole("row")).toHaveCount(51);
  await expect(page.locator("body")).not.toContainText("合成输入 1");
  await page.getByRole("navigation", { name: "平台导航" }).getByRole("link", { name: "演示导览", exact: true }).click();
  await expect(page).toHaveURL(/chapter=history$/);
  await page.getByRole("link", { name: "下一章：失败定位", exact: true }).click();
  await expect(page).toHaveURL(/chapter=observability$/);
});

test("observability and assistant round trips run nothing and lead to public engineering evidence", async ({ page }) => {
  await page.goto("/interview-demo?chapter=observability");
  await page.getByRole("link", { name: "打开 Agent 观测", exact: true }).click();
  await expect(page.getByRole("button", { name: "运行 LangGraph 实验", exact: true })).toBeEnabled();
  await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("选择上方一种实验后开始");
  await expect(page.getByRole("button", { name: "下载实验 JSON", exact: true })).toBeDisabled();
  await page.getByRole("navigation", { name: "平台导航" }).getByRole("link", { name: "演示导览", exact: true }).click();
  await expect(page).toHaveURL(/chapter=observability$/);
  await page.getByRole("link", { name: "下一章：助手互联", exact: true }).click();
  await page.getByRole("link", { name: "打开助手工具", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("尚未调用");
  await page.getByRole("navigation", { name: "平台导航" }).getByRole("link", { name: "演示导览", exact: true }).click();
  await expect(page).toHaveURL(/chapter=assistant$/);
  await page.getByRole("link", { name: "下一章：工程证据", exact: true }).click();
  await expect(page.getByText("导览结束，不自动运行任务", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /开源复用与我们的取舍/ })).toHaveAttribute("target", "_blank");
  await page.getByRole("link", { name: "回到平台总览", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=overview$/);
});

test("fixed Chinese Markdown download matches real source and contains no archive data", async ({ page }) => {
  await page.goto("/interview-demo?chapter=observability");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载中文讲解手册", exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("中文评测工作台-面试演示手册.md");
  expect(await readFile((await download.path())!, "utf8")).toBe(renderInterviewGuide());
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  if (process.env.INTERVIEW_EVIDENCE_PATH) {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.screenshot({ path: process.env.INTERVIEW_EVIDENCE_PATH, fullPage: true });
  }
});

test("unknown and duplicated chapters recover safely; mobile and keyboard navigation stay usable", async ({ page }) => {
  for (const query of ["chapter=synthetic-private-query", "chapter=history&chapter=assistant"]) {
    await page.goto(`/interview-demo?${query}`);
    await expect(page.getByRole("status", { name: "章节提示" })).toContainText("未识别该章节");
    await expect(page.getByRole("heading", { level: 2, name: "不是再造一个大平台，而是把评测工作组织清楚。" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("synthetic-private-query");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const link = page.getByRole("navigation", { name: "演示章节" }).getByRole("link", { name: /失败定位/ });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/chapter=observability$/);
  await expect(page.getByRole("status", { name: "章节提示" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "最终任务成功，过程也可能出过错。" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "上一章：历史规模", exact: true }).click();
  await expect(page).toHaveURL(/chapter=history$/);
});

test("download failure is explained and recoverable without leaking exception text or changing chapter", async ({ page }) => {
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    let first = true;
    URL.createObjectURL = (object) => {
      if (first) { first = false; throw new Error("synthetic-private-download-error"); }
      return original(object);
    };
  });
  await page.goto("/interview-demo?chapter=history");
  const button = page.getByRole("button", { name: "下载中文讲解手册", exact: true });
  await button.click();
  await expect(page.getByRole("alert", { name: "手册下载错误" })).toContainText("手册下载失败，请重试");
  await expect(page.locator("body")).not.toContainText("synthetic-private-download-error");
  await expect(page).toHaveURL(/chapter=history$/);
  const event = page.waitForEvent("download");
  await button.click();
  const download = await event;
  expect(await readFile((await download.path())!, "utf8")).toBe(renderInterviewGuide());
  await expect(page.getByRole("alert", { name: "手册下载错误" })).toHaveCount(0);
});
