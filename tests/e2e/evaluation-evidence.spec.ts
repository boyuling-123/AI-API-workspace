import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { structuredRubric } from "./fixtures/structuredRubric";

test("shows, persists, and exports validated Judge evidence without extra calls", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const runCalls: Record<string, unknown>[] = [];
  const evaluateCalls: Record<string, unknown>[] = [];
  const unexpectedApiCalls: string[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      runCalls.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outputText: "该回复承诺 24 小时内退款",
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
            structuredRubric("事实准确性", "结论必须有输入和目标输出证据"),
          ],
        }),
      });
      return;
    }
    if (pathname === "/api/gen-eval-prompt") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ evalPrompt: "Mock evidence Judge Prompt" }),
      });
      return;
    }
    if (pathname === "/api/evaluate") {
      const body = route.request().postDataJSON() as {
        item: {
          inputId: string;
          targets: { targetId: string; targetName: string }[];
        };
      };
      evaluateCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          inputId: body.item.inputId,
          scores: body.item.targets.map((target) => ({
            targetId: target.targetId,
            targetName: target.targetName,
            dimensionScores: [
              {
                dimension: "事实准确性",
                score: 8.5,
                comment: "输入需求与退款承诺可定位",
                evidence: [
                  {
                    kind: "text_quote",
                    source: "input_prompt",
                    quote: "客户申请退款",
                    start: 0,
                    end: 6,
                  },
                  {
                    kind: "text_quote",
                    source: "target_output",
                    targetId: target.targetId,
                    quote: "24 小时内退款",
                    start: 6,
                    end: 14,
                  },
                ],
              },
            ],
            weightedScore: 8.5,
            vetoed: false,
            vetoReasons: [],
            overallComment: "结论具备可回查引用",
          })),
          summary: "所有评分均保存了结构化证据",
          recommendation: "可进入人工抽检",
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
  await inputSection.getByRole("button", { name: "+ 新增一行" }).click();
  await inputSection
    .locator("tbody tr")
    .last()
    .locator("input")
    .first()
    .fill("客户申请退款");

  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect.poll(() => runCalls.length).toBe(1);
  await expect(
    page.getByRole("button", { name: "运行", exact: true })
  ).toBeEnabled();

  await page.getByRole("tab", { name: /跑批历史/ }).click();
  await page.getByRole("button", { name: "去AI评测" }).click();
  await page.getByLabel("启用 AI 自评").check();
  await page.getByLabel("裁判模型").selectOption("qwen3.6-plus");
  await page.getByLabel("评测目标").fill("核验客服退款结论");
  await page.getByLabel("业务场景").fill("客服答案上线前复核");
  await page.getByRole("button", { name: "AI 生成评价维度" }).click();
  await page.getByLabel("选择维度 事实准确性").check();
  await page.getByRole("button", { name: "确认评价策略" }).click();
  await page
    .getByRole("button", { name: "按维度自动生成评价 Prompt" })
    .click();
  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  await page
    .getByRole("dialog", { name: "确认正式 AI 评价" })
    .getByRole("button", { name: "确认并开始评价" })
    .click();
  await expect.poll(() => evaluateCalls.length).toBe(1);
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();

  const immediateEvidence = page.getByLabel(
    /查看 输入 1 DeepSeek V4 Pro 事实准确性 Judge 引用证据（2 条）/
  );
  await immediateEvidence.click();
  await expect(page.getByText("输入 prompt", { exact: true })).toBeVisible();
  await expect(page.getByText("24 小时内退款", { exact: true })).toBeVisible();
  await expect(page.getByText("[6, 14)", { exact: true })).toBeVisible();

  const modelCallCount = runCalls.length + evaluateCalls.length;
  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const detail = page.locator("section[id^='evaluation-case-details-']");
  const historyEvidence = detail.getByLabel(
    /查看 DeepSeek V4 Pro 事实准确性 Judge 引用证据（2 条）/
  );
  await historyEvidence.click();
  const historyEvidencePanel = historyEvidence.locator("xpath=..");
  await expect(
    historyEvidencePanel.getByText("客户申请退款", { exact: true })
  ).toBeVisible();
  await expect(
    historyEvidencePanel.getByText("DeepSeek V4 Pro 输出", { exact: true })
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include("section[id^='evaluation-case-details-']")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await detail
      .locator("div.overflow-x-auto")
      .last()
      .evaluate((element) => {
        element.scrollLeft = 430;
      });
    await detail.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await page.screenshot({
      path: "docs/evidence/pr-07e/evaluation-evidence.png",
      fullPage: false,
    });
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出Excel" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const workbook = XLSX.readFile(downloadPath!);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });
  expect(rows).toHaveLength(1);
  const evidenceCell = String(
    rows[0]["DeepSeek V4 Pro_事实准确性_证据"]
  );
  expect(evidenceCell).toContain("输入 prompt[0, 6)：「客户申请退款」");
  expect(evidenceCell).toContain(
    "DeepSeek V4 Pro 输出[6, 14)：「24 小时内退款」"
  );

  await page.reload();
  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const reloadedDetail = page.locator("section[id^='evaluation-case-details-']");
  await reloadedDetail
    .getByLabel(
      /查看 DeepSeek V4 Pro 事实准确性 Judge 引用证据（2 条）/
    )
    .click();
  await expect(
    reloadedDetail.getByText("24 小时内退款", { exact: true })
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true);
  expect(runCalls.length + evaluateCalls.length).toBe(modelCallCount);
  expect(unexpectedApiCalls).toEqual([]);
});
