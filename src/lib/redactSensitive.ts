const REDACTION = "[REDACTED]";

export interface RedactSensitiveOptions {
  knownSecrets?: readonly (string | null | undefined)[];
}

const TOKEN_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]{8,}={0,2}\b/gi,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
];

const SENSITIVE_ASSIGNMENT =
  /((?:["']?)[A-Za-z0-9_.-]*(?:api[_-]?key|apikey|access[_-]?token|authorization|auth[_-]?token|token|secret|password|passwd|pwd)(?:["']?)\s*[:=]\s*)(["']?)(?:Bearer\s+)?([^"',\s;}\]]+)\2/gi;

/** Removes known credentials and common token forms before text leaves a server boundary. */
export function redactSensitiveText(
  value: string,
  options: RedactSensitiveOptions = {}
): string {
  let redacted = value;
  const knownSecrets = Array.from(
    new Set(
      (options.knownSecrets ?? []).filter(
        (secret): secret is string => typeof secret === "string" && secret.length > 0
      )
    )
  ).sort((left, right) => right.length - left.length);

  for (const secret of knownSecrets) {
    redacted = redacted.split(secret).join(REDACTION);
  }

  redacted = redacted.replace(
    SENSITIVE_ASSIGNMENT,
    (_match, prefix: string, quote: string) => `${prefix}${quote}${REDACTION}${quote}`
  );

  for (const pattern of TOKEN_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTION);
  }

  return redacted;
}
