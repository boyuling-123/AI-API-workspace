import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "../../src/lib/redactSensitive";

describe("redactSensitiveText", () => {
  it("redacts a known secret everywhere without changing surrounding text", () => {
    const secret = "short-but-known";
    const result = redactSensitiveText(
      `request=${secret}; response=${secret}; status=ok`,
      { knownSecrets: [secret] }
    );

    expect(result).toBe("request=[REDACTED]; response=[REDACTED]; status=ok");
  });

  it("redacts common assignments, authorization headers, and token forms", () => {
    const awsStyleToken = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
    const source = [
      '"apiKey": "plain-value"',
      "DASHSCOPE_API_KEY=another-value",
      "Authorization: Bearer bearer-token-value",
      "token=token-value",
      "sk-exampletoken123456",
      awsStyleToken,
    ].join("\n");
    const result = redactSensitiveText(source);

    expect(result).not.toContain("plain-value");
    expect(result).not.toContain("another-value");
    expect(result).not.toContain("bearer-token-value");
    expect(result).not.toContain("token-value");
    expect(result).not.toContain("sk-exampletoken123456");
    expect(result).not.toContain(awsStyleToken);
    expect(result.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("preserves ordinary diagnostic output", () => {
    const source = "HTTP 429: retry after 3 seconds; generated 12 rows";
    expect(redactSensitiveText(source)).toBe(source);
  });
});
