import { expect, test as base } from "@playwright/test";

interface SafePageState {
  apiRequests: string[];
  browserErrors: string[];
}

export const test = base.extend<{ safePage: SafePageState }>({
  safePage: async ({ page }, use) => {
    const apiRequests: string[] = [];
    const browserErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.route("**/api/**", async (route) => {
      apiRequests.push(`${route.request().method()} ${route.request().url()}`);
      await route.fulfill({
        body: JSON.stringify({ error: "E2E blocks external API calls" }),
        contentType: "application/json",
        status: 503,
      });
    });

    await use({ apiRequests, browserErrors });

    expect(apiRequests, "safe navigation must not call an API").toEqual([]);
    expect(browserErrors, "browser console and page errors").toEqual([]);
  },
});

export { expect } from "@playwright/test";
