import { describe, expect, it } from "vitest";
import { getWorkspacePage, parseWorkspaceTab, workspaceHref, WORKSPACE_PAGES } from "../../src/lib/workspaceNavigation";

describe("workspace information architecture", () => {
  it("resolves every real tab to one primary page", () => {
    const tabs = WORKSPACE_PAGES.flatMap((page) => [...page.tabs]);
    expect(new Set(tabs.map((tab) => tab.id)).size).toBe(tabs.length);
    for (const page of WORKSPACE_PAGES) for (const tab of page.tabs) {
      expect(parseWorkspaceTab(`?tab=${tab.id}`)).toBe(tab.id);
      expect(getWorkspacePage(tab.id).id).toBe(page.id);
    }
  });
  it("defaults to history, while keeping legacy import links usable", () => {
    expect(parseWorkspaceTab("")).toBe("result");
    expect(parseWorkspaceTab("?tab=unknown")).toBe("result");
    expect(parseWorkspaceTab("?tab=run&draft_id=synthetic")).toBe("run");
    expect(workspaceHref("?draft_id=synthetic&mode=reference", "dataset")).toBe("/?draft_id=synthetic&mode=reference&tab=dataset");
  });
});
