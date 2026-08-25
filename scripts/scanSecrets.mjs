import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const candidateFiles = execFileSync(
  "git",
  ["ls-files", "-co", "--exclude-standard", "-z"],
  { encoding: "utf8" }
)
  .split("\0")
  .filter(Boolean);

const scannerPath = "scripts/scanSecrets.mjs";
const findings = [];
const secretPatterns = [
  {
    name: "private-key-block",
    pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/,
  },
  { name: "openai-or-dashscope-key", pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "github-token", pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/ },
  { name: "github-fine-grained-token", pattern: /github_pat_[A-Za-z0-9_]{20,}/ },
  { name: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "google-api-key", pattern: /AIza[0-9A-Za-z_-]{30,}/ },
  { name: "slack-token", pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: "huggingface-token", pattern: /hf_[A-Za-z0-9]{30,}/ },
  { name: "npm-token", pattern: /npm_[A-Za-z0-9]{30,}/ },
  { name: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/i },
];

function isForbiddenTrackedFile(file) {
  const name = basename(file);
  const isEnvironmentFile = name === ".env" || name.startsWith(".env.");
  const isAllowedEnvironmentExample = isEnvironmentFile && name.endsWith(".example");
  const isSensitiveExtension = /\.(?:pem|key|p12|pfx|log)$/i.test(name);
  const isPrivateKeyName = /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i.test(name);

  return (
    (isEnvironmentFile && !isAllowedEnvironmentExample) ||
    isSensitiveExtension ||
    isPrivateKeyName
  );
}

for (const file of candidateFiles) {
  if (isForbiddenTrackedFile(file)) {
    findings.push(`${file}: forbidden tracked file type`);
    continue;
  }
  if (file === scannerPath) {
    continue;
  }

  const absolutePath = resolve(root, file);
  if (!existsSync(absolutePath)) {
    continue;
  }

  const buffer = readFileSync(absolutePath);
  if (buffer.includes(0)) {
    continue;
  }

  const lines = buffer.toString("utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { name, pattern } of secretPatterns) {
      if (pattern.test(line)) {
        findings.push(`${file}:${index + 1}: ${name}`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error("Secret scan failed. Potential sensitive values were found:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Secret scan passed (${candidateFiles.length} repository files checked).`);
