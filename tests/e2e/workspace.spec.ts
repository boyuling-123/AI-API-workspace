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
  await expect(tabs).toHaveCount(6);
  await expect(page.getByRole("tab", { name: "跑批", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("tab", { name: /Judge 校准/ })).toBeVisible();
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
