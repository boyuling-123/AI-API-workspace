import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function openWorkspace(page: Page, path = "/") {
  await page.goto(path);
  await expect(
    page.getByRole("tablist", { name: "工作区功能导航" })
  ).toBeVisible();
}

test("keeps the batch console above input and explains target selection", async ({
  page,
  safePage,
}) => {
  await openWorkspace(page);

  const consoleBox = await page
    .getByText("批量运行控制台", { exact: true })
    .boundingBox();
  const inputBox = await page
    .getByRole("heading", { name: "输入数据" })
    .boundingBox();

  expect(consoleBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(consoleBox!.y).toBeLessThan(inputBox!.y);
  await expect(
    page.getByText("勾选本次要被测试、被对比、被 AI 评价的模型或算法接口。")
  ).toBeVisible();

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(7);
  await expect(page.getByRole("tab", { name: "跑批", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("tab", { name: "平台总览" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Judge 校准/ })).toBeVisible();
  expect(safePage.apiRequests).toEqual([]);
});

test("organizes platform capabilities without changing the default run entry", async ({
  page,
  safePage,
}) => {
  await openWorkspace(page, "/?tab=overview");

  await expect(
    page.getByRole("heading", {
      name: "把数据、跑批、评价与校准，放回一条清晰链路",
    })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "平台能力地图" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "数据准备与跑批" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "模型与算法接入" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 评价与 Evaluator" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "黄金集与 Judge 校准" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agent 与外部召唤" })).toBeVisible();
  await expect(page.getByText("大数据后端化 · 设计中", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toBeVisible();
  await expect(page.getByText("部分实现", { exact: true })).toBeVisible();
  expect(safePage.apiRequests).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.screenshot({
      path: "docs/evidence/pr-platform-overview/platform-overview.png",
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?tab=overview");
  await expect(
    page.getByRole("heading", {
      name: "把数据、跑批、评价与校准，放回一条清晰链路",
    })
  ).toBeVisible();
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);

  await page.getByRole("button", { name: /开始批量运行/ }).first().click();
  await expect(page.getByRole("tab", { name: "跑批", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByText("批量运行控制台", { exact: true })).toBeVisible();
  expect(safePage.apiRequests).toEqual([]);
});

test("labels unavailable external routes as design or demo", async ({
  page,
  safePage,
}) => {
  await openWorkspace(page);
  await page.getByRole("tab", { name: "接口创建&管理" }).click();

  await expect(
    page.getByRole("heading", { name: "可拆成外部 API 的小能力点" })
  ).toBeVisible();
  await expect(
    page.getByText("规划路由 · /api/import-dataset", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("规划路由 · /api/import-target", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("规划路由 · /api/judge-reference", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("规划路由 · /api/run-batch", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("设计中", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Demo · 无独立接口", { exact: true })).toHaveCount(2);
  expect(safePage.apiRequests).toEqual([]);
});

test("opens deep links in batch mode without starting evaluation", async ({
  page,
  safePage,
}) => {
  await openWorkspace(
    page,
    "/?tab=run&draft_id=demo_draft&mode=reference&content_mode=text"
  );

  await expect(page.getByRole("button", { name: "批量导入" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByRole("button", { name: "文生成类" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(safePage.apiRequests).toEqual([]);
});

test("guides direct AI evaluation visits back to batch history", async ({
  page,
  safePage,
}) => {
  await openWorkspace(page);
  await page.getByRole("tab", { name: "AI 评价", exact: true }).click();

  await expect(
    page.getByText("请从【结果与历史】选择批次后点「去AI评测」进入。")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "返回结果与历史" })).toBeVisible();
  expect(safePage.apiRequests).toEqual([]);
});

for (const target of [
  { name: "run workspace", path: "/" },
  { name: "platform overview", path: "/?tab=overview" },
  { name: "API capability workspace", path: "/?tab=access" },
]) {
  test(`${target.name} has no serious accessibility violations`, async ({
    page,
    safePage,
  }) => {
    await openWorkspace(page, target.path);
    if (target.path.includes("access")) {
      await expect(
        page.getByRole("heading", { name: "可拆成外部 API 的小能力点" })
      ).toBeVisible();
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blockingViolations = results.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    );
    const blockingSummary = blockingViolations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target),
    }));

    expect(blockingSummary).toEqual([]);
    expect(safePage.apiRequests).toEqual([]);
  });
}
