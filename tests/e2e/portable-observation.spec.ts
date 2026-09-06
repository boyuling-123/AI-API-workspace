import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { OBSERVATION_FILE_LIMIT } from "../../src/lib/portableAgentExperiment";

const test = base.extend<{ guarded: { apiCalls: string[] } }>({
  guarded: [async ({ page }, use) => {
    const apiCalls: string[] = [], unexpected: string[] = [], errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/")) apiCalls.push(`${route.request().method()} ${url.pathname}`);
      if (!["localhost", "127.0.0.1"].includes(url.hostname) || (url.pathname.startsWith("/api/") && url.pathname !== "/api/experiments/langgraph")) {
        unexpected.push(url.pathname); await route.abort();
      } else await route.fallback();
    });
    await use({ apiCalls });
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

async function downloadResult(page: Page) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载实验 JSON" }).click();
  const download = await event;
  const path = (await download.path())!;
  return { path, result: JSON.parse(await readFile(path, "utf8")) };
}

for (const mode of ["manual", "langgraph"] as const) {
  test(`${mode} actual download reopens through preview, confirmation and unverified re-export`, async ({ page, guarded }) => {
    await page.goto("/observability");
    expect(guarded.apiCalls).toEqual([]);
    await page.getByRole("button", { name: mode === "manual" ? "运行 3 组本地实验" : "运行 LangGraph 实验", exact: true }).click();
    await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
    const original = await downloadResult(page);
    expect(original.result).not.toHaveProperty("provenance");
    await page.reload();
    const input = page.getByLabel("选择观测 JSON 文件", { exact: true });
    const chooserEvent = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "选择本机 JSON 文件", exact: true }).focus();
    await page.keyboard.press("Enter");
    await (await chooserEvent).setFiles(original.path);
    const preview = page.getByRole("region", { name: "观测文件预览" });
    await expect(preview).toContainText(mode === "manual" ? "3 条调用链 / 14 个步骤" : "2 条调用链 / 7 个步骤");
    await expect(preview).toContainText("来源未认证");
    await expect(page.getByRole("button", { name: "下载实验 JSON" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "运行 3 组本地实验", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "取消回读，保留当前结果", exact: true }).click();
    await expect(preview).not.toBeVisible();
    await expect(page.getByRole("button", { name: "下载实验 JSON" })).toBeDisabled();
    await input.setInputFiles(original.path);
    const confirm = page.getByRole("button", { name: "确认加载观测文件", exact: true });
    await confirm.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("文件已加载，未重新执行");
    await expect(page.getByLabel("当前结果来源")).toContainText("外部文件回读，来源未认证");
    await expect(page.getByLabel("当前结果来源")).not.toContainText("真实调度");
    await expect(page.getByRole("row")).toHaveCount(mode === "manual" ? 4 : 3);
    await page.getByRole("button", { name: "查看失败重试调用链" }).click();
    const exported = await downloadResult(page);
    expect(exported.result).toEqual({ ...original.result, provenance: { kind: "local-file", verification: "unverified" } });
    await input.setInputFiles(exported.path);
    await expect(preview).toContainText("原结果尚未更改，可先下载保留");
    if (process.env.PORTABLE_OBSERVATION_EVIDENCE_PATH && mode === "manual") {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.screenshot({ path: process.env.PORTABLE_OBSERVATION_EVIDENCE_PATH, fullPage: true, animations: "disabled" });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "取消回读，保留当前结果", exact: true }).click();
    expect((await downloadResult(page)).result).toEqual(exported.result);
    expect(guarded.apiCalls).toEqual(mode === "manual" ? [] : ["POST /api/experiments/langgraph"]);
  });
}

test("bad, ambiguous and oversized files preserve the current result; retry succeeds", async ({ page, guarded }) => {
  await page.goto("/observability");
  await page.getByRole("button", { name: "运行 3 组本地实验", exact: true }).click();
  await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
  const original = await downloadResult(page);
  const input = page.getByLabel("选择观测 JSON 文件", { exact: true });
  const malformed = structuredClone(original.result);
  malformed.spans[1].parentSpanId = malformed.spans[1].spanId;
  for (const content of ["synthetic-private-file-body", '{"schemaVersion":1,"schemaVersion":1}', JSON.stringify(malformed), " ".repeat(OBSERVATION_FILE_LIMIT + 1)]) {
    await input.setInputFiles({ name: "synthetic-private-name.json", mimeType: "application/json", buffer: Buffer.from(content) });
    await expect(page.getByRole("alert", { name: "观测文件错误" })).toContainText("未替换当前结果");
    await expect(page.locator("body")).not.toContainText("synthetic-private");
    await expect(page.getByRole("region", { name: "观测文件预览" })).not.toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(4);
    expect((await downloadResult(page)).result).toEqual(original.result);
  }
  await input.setInputFiles(original.path);
  await page.getByRole("button", { name: "确认加载观测文件", exact: true }).click();
  await expect(page.getByRole("alert", { name: "观测文件错误" })).not.toBeVisible();
  await expect(page.getByLabel("当前结果来源")).toContainText("来源未认证");
  expect(guarded.apiCalls).toEqual([]);
});

test("cancelled late reads cannot refill preview; read failure is private and recoverable", async ({ page, guarded }) => {
  await page.goto("/observability");
  await page.getByRole("button", { name: "运行 3 组本地实验", exact: true }).click();
  await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
  const original = await downloadResult(page);
  await page.evaluate(() => {
    const originalText = File.prototype.text;
    File.prototype.text = function () {
      if (this.name === "failed.json") return Promise.reject(new Error("synthetic-private-read-path"));
      if (this.name !== "slow.json") return originalText.call(this);
      return new Promise<string>((resolve) => {
        Object.assign(window, { releaseObservationRead: async () => { resolve(await originalText.call(this)); } });
      });
    };
  });
  const input = page.getByLabel("选择观测 JSON 文件", { exact: true });
  await input.setInputFiles({ name: "slow.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(original.result)) });
  await expect(page.getByRole("status", { name: "文件读取状态" })).toBeVisible();
  await expect(input).toBeDisabled();
  await page.getByRole("button", { name: "取消回读，保留当前结果", exact: true }).click();
  await page.evaluate(async () => { await (window as unknown as { releaseObservationRead: () => Promise<void> }).releaseObservationRead(); });
  await expect(page.getByRole("region", { name: "观测文件预览" })).not.toBeVisible();
  await expect(page.getByRole("status", { name: "文件读取状态" })).not.toBeVisible();
  expect((await downloadResult(page)).result).toEqual(original.result);
  await input.setInputFiles({ name: "failed.json", mimeType: "application/json", buffer: Buffer.from("synthetic") });
  await expect(page.getByRole("alert", { name: "观测文件错误" })).toContainText("无法读取所选文件");
  await expect(page.locator("body")).not.toContainText("synthetic-private-read-path");
  await input.setInputFiles(original.path);
  await expect(page.getByRole("region", { name: "观测文件预览" })).toBeVisible();
  await page.getByRole("button", { name: "取消回读，保留当前结果", exact: true }).click();
  expect((await downloadResult(page)).result).toEqual(original.result);
  expect(guarded.apiCalls).toEqual([]);
});

test("download failure retains loaded file provenance and the user can retry or explicitly run anew", async ({ page, guarded }) => {
  await page.goto("/observability");
  await page.getByRole("button", { name: "运行 3 组本地实验", exact: true }).click();
  await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
  const original = await downloadResult(page);
  await page.getByLabel("选择观测 JSON 文件", { exact: true }).setInputFiles(original.path);
  await page.getByRole("button", { name: "确认加载观测文件", exact: true }).click();
  await page.evaluate(() => {
    const originalCreate = URL.createObjectURL;
    Object.assign(window, { restoreObservationDownload: () => { URL.createObjectURL = originalCreate; } });
    URL.createObjectURL = () => { throw new Error("synthetic-private-download"); };
  });
  await page.getByRole("button", { name: "下载实验 JSON" }).click();
  await expect(page.getByRole("alert", { name: "观测下载错误" })).toContainText("当前结果保留");
  await expect(page.getByLabel("当前结果来源")).toContainText("来源未认证");
  await expect(page.locator("body")).not.toContainText("synthetic-private-download");
  await page.evaluate(() => { (window as unknown as { restoreObservationDownload: () => void }).restoreObservationDownload(); });
  const restored = await downloadResult(page);
  expect(restored.result.provenance.verification).toBe("unverified");
  await page.getByRole("button", { name: "运行 3 组本地实验", exact: true }).click();
  await expect(page.getByRole("status", { name: "实验采集状态" })).toContainText("采集完成");
  await expect(page.getByLabel("当前结果来源")).not.toContainText("来源未认证");
  expect((await downloadResult(page)).result).not.toHaveProperty("provenance");
  expect(guarded.apiCalls).toEqual([]);
});
