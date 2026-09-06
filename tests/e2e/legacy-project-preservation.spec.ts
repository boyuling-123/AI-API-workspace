import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { SCHEMA_VERSION } from "../../src/types";
import { expect, test } from "./fixtures";

const retained = [
  { id: "synthetic-old", version: SCHEMA_VERSION - 1, name: "合成旧项目", updateTime: 999,
    unknownField: { preserved: [null, 0, "合成历史正文"] } },
  { id: "synthetic-no-index", raw: "合成缺字段记录" },
];
const current = {
  id: "synthetic-current", version: SCHEMA_VERSION, name: "合成可用项目",
  createTime: 1, updateTime: 20, targetConfigs: [], tasks: [], evaluations: [],
};

// Separate route opens the origin without loading AppShell or touching projects.
async function seed(page: Page, records: unknown[]) {
  await page.goto("/observability");
  await page.evaluate(async (rows) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("eval-platform", 1);
      open.onupgradeneeded = () => {
        const table = open.result.createObjectStore("projects", { keyPath: "id" });
        table.createIndex("updateTime", "updateTime");
      };
      open.onerror = () => reject(new Error("Synthetic seed open failed"));
      open.onsuccess = () => {
        const connection = open.result;
        const tx = connection.transaction("projects", "readwrite");
        for (const row of rows) tx.objectStore("projects").put(row);
        tx.oncomplete = () => { connection.close(); resolve(); };
        tx.onabort = () => { connection.close(); reject(new Error("Synthetic seed aborted")); };
      };
    });
  }, records);
}

async function readRecords(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("eval-platform");
    open.onerror = () => reject(new Error("Synthetic read failed"));
    open.onsuccess = () => {
      const connection = open.result;
      const tx = connection.transaction("projects", "readonly");
      const read = tx.objectStore("projects").getAll();
      tx.oncomplete = () => { connection.close(); resolve(read.result); };
      tx.onabort = () => { connection.close(); reject(new Error("Synthetic read aborted")); };
    };
  }));
}

async function openWorkspace(page: Page) {
  await page.goto("/?tab=overview");
  await expect(page.getByRole("tablist", { name: "工作区功能导航" })).toBeVisible();
}

test("retains mixed legacy records across editing and reload, with an accessible warning", async ({ page, safePage }) => {
  await seed(page, [...retained, current]);
  await openWorkspace(page);
  const notice = page.getByRole("status", { name: "旧项目保留提示" });
  await expect(notice).toContainText("发现 2 条");
  await expect(notice).toContainText("当前项目导出不包含这些记录");
  await expect(page.getByPlaceholder("项目名称")).toHaveValue(current.name);
  await page.getByPlaceholder("项目名称").fill("合成项目编辑完成");
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  await expect(notice).toBeVisible();
  await page.reload();
  await expect(page.getByPlaceholder("项目名称")).toHaveValue("合成项目编辑完成");
  const stored = await readRecords(page);
  expect(stored).toHaveLength(3);
  for (const item of retained) expect(stored.find(({ id }) => id === item.id)).toEqual(item);
  const results = await new AxeBuilder({ page }).include('[aria-label="旧项目保留提示"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  if (process.env.CAPTURE_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: process.env.STORAGE_EVIDENCE_PATH ?? "docs/evidence/pr-legacy-project-preservation/legacy-preserved.png",
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(notice).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(safePage.apiRequests).toEqual([]);
});

test("all-legacy catalog creates only one new project and keeps every original row", async ({ page, safePage }) => {
  await seed(page, retained);
  await openWorkspace(page);
  await expect(page.getByPlaceholder("项目名称")).toHaveValue("未命名项目");
  await expect(page.getByRole("status", { name: "旧项目保留提示" })).toContainText("发现 2 条");
  const before = await readRecords(page);
  expect(before).toHaveLength(3);
  await page.reload();
  await expect(page.getByRole("tablist", { name: "工作区功能导航" })).toBeVisible();
  expect(await readRecords(page)).toEqual(before);
  await page.getByPlaceholder("项目名称").fill("合成新项目");
  await expect(page.getByText("已自动保存", { exact: true })).toBeVisible();
  const after = await readRecords(page);
  expect(after).toHaveLength(3);
  for (const item of retained) expect(after.find(({ id }) => id === item.id)).toEqual(item);
  expect(safePage.apiRequests).toEqual([]);
});

test("quota failure does not claim saved or expose raw exception details", async ({ page, safePage }) => {
  await seed(page, [...retained, current]);
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("PRIVATE_TEST_DETAIL", "QuotaExceededError");
    };
  });
  await openWorkspace(page);
  await page.getByPlaceholder("项目名称").fill("合成未保存编辑");
  await expect(page.getByText(/存储空间不足，当前更改尚未保存/)).toBeVisible();
  await expect(page.getByText("已自动保存", { exact: true })).toBeHidden();
  await expect(page.getByRole("status", { name: "旧项目保留提示" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("PRIVATE_TEST_DETAIL");
  const stored = await readRecords(page);
  expect(stored.find(({ id }) => id === current.id)).toEqual(current);
  for (const item of retained) expect(stored.find(({ id }) => id === item.id)).toEqual(item);
  expect(safePage.browserErrors).toEqual([]);
});

test("storage read failure falls back visibly without exposing or clearing records", async ({ page, safePage }) => {
  await seed(page, [...retained, current]);
  await page.addInitScript(() => {
    IDBObjectStore.prototype.getAll = function () {
      throw new DOMException("PRIVATE_TEST_DETAIL", "UnknownError");
    };
  });
  await openWorkspace(page);
  await expect(page.getByText(/本地项目加载失败，当前为临时项目/)).toBeVisible();
  await expect(page.getByText("已自动保存", { exact: true })).toBeHidden();
  await expect(page.locator("body")).not.toContainText("PRIVATE_TEST_DETAIL");
  await expect(page.getByPlaceholder("项目名称")).toHaveValue("未命名项目");
  // Read with a cursor because getAll is deliberately broken in this page.
  const rows = await page.evaluate(() => new Promise<unknown[]>((resolve, reject) => {
    const open = indexedDB.open("eval-platform");
    open.onerror = () => reject(new Error("Synthetic cursor open failed"));
    open.onsuccess = () => {
      const connection = open.result;
      const tx = connection.transaction("projects", "readonly");
      const result: unknown[] = [];
      const request = tx.objectStore("projects").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { result.push(cursor.value); cursor.continue(); }
      };
      tx.oncomplete = () => { connection.close(); resolve(result); };
      tx.onabort = () => { connection.close(); reject(new Error("Synthetic cursor aborted")); };
    };
  }));
  expect(rows).toHaveLength(3);
  expect(rows).toEqual(expect.arrayContaining([...retained, current]));
  expect(safePage.browserErrors).toEqual([]);
});
