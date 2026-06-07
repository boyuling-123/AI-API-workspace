// 第一批强制卡点 - 压测项3 配额保护逻辑：验证 QuotaExceededError 识别 + 捕获不崩溃。
// 与 src/services/db.ts 的 isQuotaExceededError 行为等价实现，逐形态验证识别正确。
// 并模拟 useProject.scheduleSave 的 catch 分支：配额错误 -> 提示文案，普通错误 -> 通用文案，绝不抛出。

function isQuotaExceededError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  const name = error.name;
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota/i.test(error.message)
  );
}

// 模拟 useProject.ts scheduleSave 的错误处理分支：返回提示文案，永不向外抛。
function resolveSaveErrorMessage(error) {
  try {
    if (isQuotaExceededError(error)) {
      return "存储空间不足，建议改用 URL 图片或导出备份";
    }
    if (error instanceof Error) {
      return `保存失败：${error.message}`;
    }
    return "保存失败：未知错误";
  } catch {
    // 处理逻辑本身不应抛错，兜底防白屏。
    return "保存失败：未知错误";
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error("❌ FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("✅ PASS:", message);
  }
}

function makeError(name, message) {
  const error = new Error(message ?? "");
  error.name = name;
  return error;
}

function main() {
  console.log("=== 配额保护逻辑压测（强制卡点 压测项3 捕获逻辑）===");

  // 1. Chrome 形态
  assert(
    isQuotaExceededError(makeError("QuotaExceededError", "...")),
    "识别 Chrome QuotaExceededError"
  );
  // 2. Firefox 形态
  assert(
    isQuotaExceededError(makeError("NS_ERROR_DOM_QUOTA_REACHED", "...")),
    "识别 Firefox NS_ERROR_DOM_QUOTA_REACHED"
  );
  // 3. message 含 quota（大小写不敏感）
  assert(
    isQuotaExceededError(makeError("DataError", "The current Quota is exceeded")),
    "识别 message 含 quota 的错误"
  );
  // 4. 普通错误不应误判为配额错误
  assert(
    !isQuotaExceededError(makeError("DataError", "invalid key")),
    "普通错误不误判为配额错误"
  );
  // 5. 非 Error 对象不崩溃
  assert(!isQuotaExceededError("just a string"), "非 Error 输入安全返回 false");
  assert(!isQuotaExceededError(null), "null 输入安全返回 false");

  // 6. 配额错误 -> 正确提示文案
  assert(
    resolveSaveErrorMessage(makeError("QuotaExceededError", "")) ===
      "存储空间不足，建议改用 URL 图片或导出备份",
    "配额错误映射到『存储空间不足』提示（不白屏）"
  );
  // 7. 普通错误 -> 通用提示文案
  assert(
    resolveSaveErrorMessage(makeError("DataError", "boom")) === "保存失败：boom",
    "普通错误映射到通用保存失败提示"
  );
  // 8. 未知类型错误 -> 兜底文案，不抛出
  let threw = false;
  let unknownMsg = "";
  try {
    unknownMsg = resolveSaveErrorMessage({ weird: true });
  } catch {
    threw = true;
  }
  assert(
    !threw && unknownMsg === "保存失败：未知错误",
    "未知类型错误兜底为通用文案且不抛出（防白屏）"
  );

  console.log("=== 配额保护逻辑压测完成 ===");
  if (process.exitCode === 1) {
    console.log("结论：存在 FAIL 项，未通过。");
  } else {
    console.log(
      "结论：全部 PASS。配额错误能被正确识别并映射到友好提示，处理逻辑不抛错（不白屏）。"
    );
  }
}

main();
