import { redactSensitiveText } from "@/lib/redactSensitive";
import type { RunErrorType } from "@/types";

export const RUN_ERROR_LABELS: Record<RunErrorType, string> = {
  timeout: "请求超时",
  rate_limit: "接口限流",
  auth: "鉴权失败",
  network: "网络异常",
  parse: "响应解析失败",
  server: "服务端错误",
  client: "请求或配置错误",
  unknown: "未知错误",
};

const RETRYABLE_TYPES = new Set<RunErrorType>([
  "timeout",
  "rate_limit",
  "network",
  "server",
]);

export class RunError extends Error {
  readonly type: RunErrorType;
  readonly retryable: boolean;
  readonly httpStatus?: number;

  constructor(
    message: string,
    options: {
      type: RunErrorType;
      retryable?: boolean;
      httpStatus?: number;
      cause?: unknown;
    }
  ) {
    super(redactSensitiveText(message), { cause: options.cause });
    this.name = "RunError";
    this.type = options.type;
    this.retryable = options.retryable ?? isRetryableRunError(options.type);
    this.httpStatus = options.httpStatus;
  }
}

export function isRetryableRunError(type: RunErrorType): boolean {
  return RETRYABLE_TYPES.has(type);
}

export function isRunErrorType(value: unknown): value is RunErrorType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(RUN_ERROR_LABELS, value)
  );
}

export function createHttpRunError(status: number, message?: string): RunError {
  const type = classifyHttpStatus(status);
  return new RunError(message || `HTTP ${status}`, {
    type,
    httpStatus: status,
  });
}

export function normalizeRunError(error: unknown): RunError {
  if (error instanceof RunError) return error;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "未知错误";
  const lower = message.toLowerCase();

  if (
    (error instanceof DOMException && error.name === "AbortError") ||
    /timeout|timed out|超时/.test(lower)
  ) {
    return new RunError(message || "请求超时", {
      type: "timeout",
      cause: error,
    });
  }
  if (
    /api[_ -]?key|environment variable|环境变量|unauthori[sz]ed|forbidden|鉴权|401|403/.test(
      lower
    )
  ) {
    return new RunError(message, { type: "auth", cause: error });
  }
  if (/json|parse|unexpected token|解析/.test(lower)) {
    return new RunError(message, { type: "parse", cause: error });
  }
  if (
    error instanceof TypeError ||
    /fetch|network|econn|socket|dns|网络/.test(lower)
  ) {
    return new RunError(message, { type: "network", cause: error });
  }
  if (/missing|invalid|缺少|无效|配置|参数/.test(lower)) {
    return new RunError(message, { type: "client", cause: error });
  }
  return new RunError(message, { type: "unknown", cause: error });
}

function classifyHttpStatus(status: number): RunErrorType {
  if (status === 401 || status === 403) return "auth";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return "unknown";
}
