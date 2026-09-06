import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTERVIEW_CHAPTERS, INTERVIEW_EVIDENCE, renderInterviewGuide, resolveInterviewChapter } from "../../src/lib/interviewGuide";

describe("Chinese interview guide uses fixed real routes and honest evidence", () => {
  it("resolves every chapter and defaults missing chapter without a warning", () => {
    expect(resolveInterviewChapter(undefined)).toEqual({ index: 0, fallback: false });
    INTERVIEW_CHAPTERS.forEach((chapter, index) => {
      expect(resolveInterviewChapter(chapter.id)).toEqual({ index, fallback: false });
    });
    expect(new Set(INTERVIEW_CHAPTERS.map((chapter) => chapter.id)).size).toBe(5);
  });

  it.each([null, "", "unknown", "../history-demo", ["history", "assistant"], { chapter: "history" }])("rejects ambiguous or unknown chapter %j without reflecting it", (value) => {
    expect(resolveInterviewChapter(value)).toEqual({ index: 0, fallback: true });
  });

  it("only links to implemented routes and source evidence in this repository", () => {
    for (const chapter of INTERVIEW_CHAPTERS) {
      expect(chapter.href).toMatch(/^\/(?:\?tab=overview|history-demo|observability|assistant-tools)$/);
      const path = chapter.href.split("?")[0];
      expect(existsSync(`src/app${path === "/" ? "" : path}/page.tsx`)).toBe(true);
      expect(chapter.steps.length).toBeGreaterThanOrEqual(2);
      expect(chapter.access.length).toBeGreaterThan(20);
      expect(chapter.boundary.length).toBeGreaterThan(30);
    }
    for (const item of INTERVIEW_EVIDENCE) {
      const url = new URL(item.href);
      expect(url.origin).toBe("https://github.com");
      expect(url.pathname).toMatch(/^\/boyuling-123\/AI-API-workspace\/(?:blob\/main\/|pull\/51$)/);
      if (url.pathname.includes("/blob/main/")) expect(existsSync(url.pathname.split("/blob/main/")[1])).toBe(true);
    }
  });

  it("exports the same chapters, boundaries and evidence without local data or fake results", () => {
    const text = renderInterviewGuide();
    expect(text).toBe(renderInterviewGuide());
    expect(text).toContain("不是自动完成记录或模型测评报告");
    for (const chapter of INTERVIEW_CHAPTERS) {
      for (const content of [chapter.title, chapter.message, chapter.evidence, chapter.boundary, chapter.access, chapter.href, ...chapter.steps]) expect(text).toContain(content);
    }
    for (const item of INTERVIEW_EVIDENCE) expect(text).toContain(`[${item.title}](${item.href})`);
    expect(text).toContain("不代表任意 Agent 框架已兼容");
    expect(text).not.toMatch(/117065|55444|\/Users\/|file:\/\/|draft_id=|api_key|gold_answer|localhost|127\.0\.0\.1/);
    expect(text).toContain("点击后将读取已配置归档的索引摘要与首屏分页");
    expect(text).toContain("模型调用为 0，Token/成本未测量");
    expect(text).toContain("当前是可调用工具台，不是完整对话 Assistant");
  });
});
