import { ACTION_ERRORS, type PlatformActionName, type PlatformActionResult, type ActionErrorCode } from "@/lib/platformActions";

export async function runPlatformAction(action: PlatformActionName, signal?: AbortSignal): Promise<PlatformActionResult> {
  const response = await fetch(`/api/platform-actions?action=${action}`, {
    headers: { "x-eval-archive": "local-read" }, cache: "no-store", signal,
  }).catch((error: unknown) => {
    if (signal?.aborted) throw error;
    throw new Error(ACTION_ERRORS.SERVICE_UNAVAILABLE);
  });
  let result;
  try { result = await response.json(); } catch { throw new Error(ACTION_ERRORS.SERVICE_UNAVAILABLE); }
  if (!response.ok || result?.ok !== true || result?.data?.action !== action) {
    const code = result?.code;
    throw new Error(typeof code === "string" && Object.hasOwn(ACTION_ERRORS, code)
      ? ACTION_ERRORS[code as ActionErrorCode] : ACTION_ERRORS.SERVICE_UNAVAILABLE);
  }
  return result.data;
}
