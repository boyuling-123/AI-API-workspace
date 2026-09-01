import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { structuredRubric } from "./fixtures/structuredRubric";

test("downloads and opens a self-contained verified evaluation HTML report", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  const runCalls: Record<string, unknown>[] = [];
  const evaluateCalls: Record<string, unknown>[] = [];
  const unexpectedApiCalls: string[] = [];
  const fakeToken = `sk-${"a".repeat(24)}`;
  const embeddedImage =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/run-custom") {
      runCalls.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outputText: "该回复承诺 24 小时内退款",
          outputImages: [embeddedImage],
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
        body: JSON.stringify({
          evalPrompt: "Mock HTML report Judge Prompt",
        }),
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
    .fill(`客户申请退款 api_key=${fakeToken}`);

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

  const versionPanel = page.getByLabel("Evaluator 版本管理");
  await versionPanel.getByLabel("Evaluator 名称").fill("客服报告评价器");
  await versionPanel.getByLabel("Evaluator 修改人").fill("Lu");
  await versionPanel
    .getByLabel("Evaluator 变更说明")
    .fill("建立离线报告基线");
  await versionPanel
    .getByRole("button", { name: "保存为 Evaluator v1" })
    .click();
  await expect(
    versionPanel.getByText("已绑定不可变版本：客服报告评价器 v1")
  ).toBeVisible();

  await page.getByRole("button", { name: "开始 AI 评价" }).click();
  await page
    .getByRole("dialog", { name: "确认正式 AI 评价" })
    .getByRole("button", { name: "确认并开始评价" })
    .click();
  await expect.poll(() => evaluateCalls.length).toBe(1);
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();

  const modelCallCount = runCalls.length + evaluateCalls.length;
  await page.getByRole("tab", { name: /AI历史评价/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出HTML报告" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/_AI评价报告_.*\.html$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const html = await readFile(downloadPath!, "utf8");
  expect(html).toContain("lu-evaluation-html-report/v1");
  expect(html).toContain("Mock HTML report Judge Prompt");
  expect(html).toContain("data:image/gif;base64");
  expect(html).not.toContain(fakeToken);
  expect(html).toContain("[REDACTED]");
  expect(html).not.toMatch(/<script[^>]+src=/i);
  expect(html).not.toMatch(/<link[^>]+stylesheet/i);

  const externalRequests: string[] = [];
  const reportPage = await context.newPage();
  reportPage.on("request", (request) => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });
  await reportPage.setContent(html, { waitUntil: "load" });
  await expect(reportPage.getByRole("heading", { level: 1 })).toHaveText(
    "未命名项目"
  );
  await expect(reportPage.getByRole("status")).toHaveText(
    "完整性校验：通过"
  );
  await expect(
    reportPage.getByRole("heading", { name: "AI 原始分排行榜" })
  ).toBeVisible();
  await expect(reportPage.getByText("客服报告评价器 v1")).toBeVisible();
  await expect(
    reportPage.getByText("24 小时内退款", { exact: true })
  ).toBeVisible();
  await expect(
    reportPage.getByText("[REDACTED]", { exact: false }).first()
  ).toBeVisible();

  const envelope = JSON.parse(
    (await reportPage.locator("#report-snapshot").textContent()) ?? ""
  ) as {
    fingerprint: string;
    payload: {
      evaluatorVersion: { status: string; snapshot?: { version: number } };
      reportPolicy: { leaderboardBasis: string; remoteImages: string };
    };
  };
  expect(envelope.fingerprint).toMatch(/^report:v1:/);
  expect(envelope.payload.evaluatorVersion).toMatchObject({
    status: "verified",
    snapshot: { version: 1 },
  });
  expect(envelope.payload.reportPolicy).toMatchObject({
    leaderboardBasis: "ai_original_scores",
    remoteImages: "referenced_not_embedded",
  });

  const accessibility = await new AxeBuilder({ page: reportPage })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);

  if (process.env.CAPTURE_EVIDENCE === "1") {
    await reportPage.setViewportSize({ width: 1440, height: 1100 });
    await reportPage.screenshot({
      path: "docs/evidence/pr-07f/evaluation-html-report.png",
      fullPage: true,
    });
  }

  await reportPage.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      reportPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true);
  expect(externalRequests).toEqual([]);
  expect(runCalls.length + evaluateCalls.length).toBe(modelCallCount);
  expect(unexpectedApiCalls).toEqual([]);
  await reportPage.close();
});
