import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const scannerPath = fileURLToPath(
  new URL("../../scripts/scanSecrets.mjs", import.meta.url)
);
const temporaryRepositories: string[] = [];

function createRepository(files: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "eval-platform-secret-scan-"));
  temporaryRepositories.push(directory);
  execFileSync("git", ["init", "--quiet"], { cwd: directory });

  Object.entries(files).forEach(([file, content]) => {
    const absolutePath = join(directory, file);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");
  });
  execFileSync("git", ["add", "."], { cwd: directory });
  return directory;
}

function runScanner(cwd: string) {
  return spawnSync(process.execPath, [scannerPath], {
    cwd,
    encoding: "utf8",
  });
}

afterEach(() => {
  temporaryRepositories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("secret scan CLI", () => {
  it("allows placeholder environment examples", () => {
    const repository = createRepository({
      ".env.local.example": "DASHSCOPE_API_KEY=your_dashscope_api_key\n",
      "README.md": "safe fixture\n",
    });

    const result = runScanner(repository);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Secret scan passed");
  });

  it("rejects tracked non-example environment files", () => {
    const repository = createRepository({
      ".env.local": "DASHSCOPE_API_KEY=not-a-real-secret\n",
    });

    const result = runScanner(repository);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".env.local: forbidden tracked file type");
  });

  it("reports a token location without echoing the token", () => {
    const fakeToken = `sk-${"a".repeat(24)}`;
    const repository = createRepository({
      "config.txt": `API_KEY=${fakeToken}\n`,
    });

    const result = runScanner(repository);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("config.txt:1: openai-or-dashscope-key");
    expect(result.stderr).not.toContain(fakeToken);
    expect(result.stdout).not.toContain(fakeToken);
  });
});
