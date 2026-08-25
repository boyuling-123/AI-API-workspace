import type { TaskInput } from "@/types";

export const AUTO_EXPECTED_ANSWER_KEY = "__auto__";

export const EXPECTED_ANSWER_KEYS = [
  "expected_output",
  "expected",
  "standard_answer",
  "reference_answer",
  "answer",
  "output",
  "label",
  "标准答案",
  "参考答案",
  "正确答案",
  "答案",
] as const;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function stringifyExpectedAnswer(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

export function collectExtraFieldKeys(inputs: TaskInput[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    for (const key of Object.keys(input.extraFields ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

export function sortExpectedAnswerKeys(keys: string[]): string[] {
  const priority = new Map(
    EXPECTED_ANSWER_KEYS.map((key, index) => [normalizeKey(key), index])
  );
  return [...keys].sort((left, right) => {
    const leftPriority = priority.get(normalizeKey(left)) ?? 999;
    const rightPriority = priority.get(normalizeKey(right)) ?? 999;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.localeCompare(right, "zh-CN");
  });
}

export function findExpectedAnswerKey(input: TaskInput): string | null {
  const extraFields = input.extraFields ?? {};
  const keys = Object.keys(extraFields);
  for (const preferred of EXPECTED_ANSWER_KEYS) {
    const normalizedPreferred = normalizeKey(preferred);
    const matched = keys.find((key) => normalizeKey(key) === normalizedPreferred);
    if (matched && stringifyExpectedAnswer(extraFields[matched])) {
      return matched;
    }
  }
  return null;
}

export function resolveExpectedAnswer(
  input: TaskInput,
  selectedKey: string = AUTO_EXPECTED_ANSWER_KEY
): { key: string | null; value: string } {
  const extraFields = input.extraFields ?? {};
  if (selectedKey !== AUTO_EXPECTED_ANSWER_KEY) {
    return {
      key: selectedKey,
      value: stringifyExpectedAnswer(extraFields[selectedKey]),
    };
  }
  const key = findExpectedAnswerKey(input);
  return {
    key,
    value: key ? stringifyExpectedAnswer(extraFields[key]) : "",
  };
}
