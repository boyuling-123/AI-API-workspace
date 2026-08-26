import { describe, expect, it } from "vitest";
import { runScript } from "../../src/services/script/runScriptService";

const API_KEY_ENV = "EVAL_PLATFORM_TEST_API_KEY";
const API_KEY_VALUE = "known-test-secret-value";

describe("runScript output redaction", () => {
  it("redacts an injected key from successful text and raw output", async () => {
    const result = await runScript({
      lang: "node",
      apiKeyEnvName: API_KEY_ENV,
      apiKeyValue: API_KEY_VALUE,
      paramValues: { prompt: "redaction test" },
      code: `
        const key = process.env.${API_KEY_ENV};
        console.log("debug=" + key);
        console.log("===RESULT_JSON_START===");
        console.log(JSON.stringify({ text: "result=" + key, images: [] }));
        console.log("===RESULT_JSON_END===");
      `,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).not.toContain(API_KEY_VALUE);
    expect(result.rawOutput).not.toContain(API_KEY_VALUE);
    expect(result.text).toContain("[REDACTED]");
    expect(result.rawOutput).toContain("[REDACTED]");
  });

  it("redacts an injected key from a failing script stderr", async () => {
    const result = await runScript({
      lang: "node",
      apiKeyEnvName: API_KEY_ENV,
      apiKeyValue: API_KEY_VALUE,
      paramValues: {},
      code: `
        console.error("failed with " + process.env.${API_KEY_ENV});
        process.exit(2);
      `,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stderr).not.toContain(API_KEY_VALUE);
    expect(result.stderr).toContain("[REDACTED]");
  });
});
