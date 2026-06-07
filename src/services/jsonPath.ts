/**
 * 轻量 JSONPath 风格提取：支持 a.b[0].c 形式的路径。
 * 用于从目标响应里按 outputTextPath / outputImagePath 提取结果。
 */
export function extractByPath(source: unknown, path?: string): unknown {
  if (!path) {
    return undefined;
  }
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((segment) => segment.length > 0);

  let current: unknown = source;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
