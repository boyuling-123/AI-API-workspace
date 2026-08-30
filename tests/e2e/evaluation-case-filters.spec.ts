import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { structuredRubric } from "./fixtures/structuredRubric";

test("filters evaluation Cases deterministically and exports only the visible subset", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const runCalls: Record<string, unknown>[] = [];
  const evaluateCalls: Record<string, unknown>[] = [];
  const unexpectedApiCalls: string[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      const body = route.request().postDataJSON() as {
        prompt: string;
        target: { id: string };
      };
      runCalls.push(body);
      if (
        body.prompt === "筛选 Case 4 运行失败" &&
        body.target.id.includes("deepseek")
      ) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Mock 上游 503" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outputText: `${body.target.id} 对 ${body.prompt} 的 Mock 输出`,
          outputImages: [],
        }),
      });
      return;
    }

    if (pathname === "/api/gen-dimensions") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dimensions: [
            structuredRubric("上线质量", "输出是否准确、完整并适合上线"),
          ],
        }),
      });
      return;
    }

    if (pathname === "/api/gen-eval-prompt") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ evalPrompt: "Mock Case filter Judge Prompt" }),
      });
      return;
    }

    if (pathname === "/api/evaluate") {
      const body = route.request().postDataJSON() as {
        item: {
          inputId: string;
          prompt: string;
          targets: { targetId: string; targetName: string }[];
        };
      };
      evaluateCalls.push(body);
      const scorePair = scoresForPrompt(body.item.prompt);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          inputId: body.item.inputId,
          scores: body.item.targets.map((target) => {
            const targetKey = target.targetId.includes("deepseek")
              ? "deepseek"
              : "kimi";
            const score = scorePair[targetKey];
            const vetoed =
              body.item.prompt === "筛选 Case 3 一票否决" &&
              targetKey === "deepseek";
            return {
              targetId: target.targetId,
              targetName: target.targetName,
              dimensionScores: [
                {
                  dimension: "上线质量",
                  score,
                  comment: `${body.item.prompt} ${target.targetName} 得分 ${score}`,
                },
              ],
              weightedScore: score,
              vetoed,
              vetoReasons: vetoed ? ["命中上线硬规则"] : [],
              overallComment: `${target.targetName} 的可解释点评`,
            };
          }),
          summary: `${body.item.prompt} 已完成评分`,
          recommendation: "按风险信号复核",
        }),
      });
      return;
    }

    unexpectedApiCalls.push(pathname);
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: `Unexpected API call: ${pathname}` }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "批量导入" }).click();
  const inputSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "输入数据" }) });
  const prompts = [
    "筛选 Case 1 低分",
    "筛选 Case 2 模型分歧",
    "筛选 Case 3 一票否决",
    "筛选 Case 4 运行失败",
    "筛选 Case 5 联合命中",
  ];
  for (const prompt of prompts) {
    await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
    await inputSection.locator("tbody tr").last().locator("input").first().fill(prompt);
  }

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: /Kimi K2.6/ }).click();
  await page.getByText("高级运行策略", { exact: true }).click();
  await page.getByLabel("失败重试次数").fill("0");
  await page.getByRole("button", { name: "批量运行", exact: true }).click();
  await expect.poll(() => runCalls.length).toBe(10);
  await expect(
    page.getByRole("button", { name: "批量运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("识别需要人工复核的 Case");
  await page.getByLabel("业务场景").fill("模型上线前批量质量复核");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 上线质量").check();
  await expect(page.getByLabel("维度 1 权重")).toHaveValue("100");
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page
    .getByRole("button", { name: "按维度自动生成评价 Prompt" })
    .click();
  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  await page
    .getByRole("dialog", { name: "确认正式 AI 评价" })
    .getByRole("button", { name: "确认并开始评价" })
    .click();
  await expect.poll(() => evaluateCalls.length).toBe(5);
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const filterPanel = page.getByLabel("评价 Case 筛选");
  await expect(filterPanel).toBeVisible();
  await expect(filterPanel.getByLabel("当前显示 5 / 5 条")).toBeVisible();
  await expect(filterPanel.getByText("确定性规则 · 0 次模型调用")).toBeVisible();

  await filterPanel.getByLabel("筛选低分 Case").check();
  await expect(filterPanel.getByLabel("当前显示 2 / 5 条")).toBeVisible();
  await expect(page.getByText("筛选 Case 1 低分", { exact: true })).toBeVisible();
  await expect(page.getByText("筛选 Case 5 联合命中", { exact: true })).toBeVisible();
  await expect(page.getByText("筛选 Case 2 模型分歧", { exact: true })).toBeHidden();

  await filterPanel.getByLabel("筛选模型分歧 Case").check();
  await expect(filterPanel.getByLabel("当前显示 3 / 5 条")).toBeVisible();
  await expect(page.getByText("筛选 Case 2 模型分歧", { exact: true })).toBeVisible();

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await filterPanel.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.screenshot({
      path: "docs/evidence/pr-07c/evaluation-case-filters.png",
      fullPage: false,
    });
  }

  await filterPanel.getByLabel("筛选组合方式").selectOption("all");
  await expect(filterPanel.getByLabel("当前显示 1 / 5 条")).toBeVisible();
  await expect(page.getByText("筛选 Case 5 联合命中", { exact: true })).toBeVisible();
  await expect(page.getByText("筛选 Case 1 低分", { exact: true })).toBeHidden();

  const downloadPromise = page.waitForEvent("download");
  await filterPanel
    .getByRole("button", { name: "导出当前筛选（1 条）" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("AI评价_筛选1条");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const workbook = XLSX.readFile(downloadPath!);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const exportedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    worksheet,
    { defval: "" }
  );
  expect(exportedRows).toHaveLength(1);
  expect(exportedRows[0]).toMatchObject({
    prompt: "筛选 Case 5 联合命中",
    筛选命中: "低分、模型分歧",
    最低加权分: 2,
    模型分差: 6,
  });
  expect(String(exportedRows[0].筛选依据)).toContain("分差 6.00");

  await filterPanel.getByRole("button", { name: "清除筛选" }).click();
  await expect(filterPanel.getByLabel("当前显示 5 / 5 条")).toBeVisible();
  await filterPanel.getByLabel("筛选失败 Case").check();
  await filterPanel.getByLabel("筛选高风险 Case").check();
  await filterPanel.getByLabel("筛选组合方式").selectOption("all");
  await expect(filterPanel.getByLabel("当前显示 0 / 5 条")).toBeVisible();
  await expect(page.getByText("当前组合没有命中 Case")).toBeVisible();
  await expect(
    filterPanel.getByRole("button", { name: "导出当前筛选（0 条）" })
  ).toBeDisabled();

  await filterPanel.getByRole("button", { name: "清除筛选" }).click();
  await filterPanel.getByLabel("低分筛选阈值").fill("5");
  await filterPanel.getByLabel("筛选低分 Case").check();
  await expect(filterPanel.getByLabel("当前显示 1 / 5 条")).toBeVisible();
  await expect(page.getByText("筛选 Case 5 联合命中", { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="评价 Case 筛选"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  const apiCallCount = runCalls.length + evaluateCalls.length;
  await page.reload();
  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  await expect(
    page.getByLabel("评价 Case 筛选").getByLabel("当前显示 5 / 5 条")
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true);
  expect(runCalls.length + evaluateCalls.length).toBe(apiCallCount);
  expect(unexpectedApiCalls).toEqual([]);
});

function scoresForPrompt(prompt: string): {
  deepseek: number;
  kimi: number;
} {
  if (prompt === "筛选 Case 1 低分") return { deepseek: 5.5, kimi: 5.8 };
  if (prompt === "筛选 Case 2 模型分歧") return { deepseek: 9, kimi: 6 };
  if (prompt === "筛选 Case 3 一票否决") return { deepseek: 8, kimi: 8.5 };
  if (prompt === "筛选 Case 4 运行失败") return { deepseek: 0, kimi: 7 };
  return { deepseek: 2, kimi: 8 };
}
