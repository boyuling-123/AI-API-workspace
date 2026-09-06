export async function readLocalArchive<T>(params: Record<string, string | number>, signal?: AbortSignal, confirmContent = false): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  const response = await fetch(`/api/local-archive?${query}`, { signal, cache: "no-store",
    headers: { "x-eval-archive": "local-read", ...(confirmContent ? { "x-eval-confirm-content": "1" } : {}) } });
  let result;
  try { result = await response.json(); } catch { throw new Error("本地归档服务未返回有效结果，请检查本机服务后重试。"); }
  if (!response.ok || !result?.ok) throw new Error(typeof result?.error === "string" ? result.error : "本地归档暂不可用。");
  return result.data as T;
}
