/**
 * 生成形如 20260601_2058 的时间戳，用于导出文件名。
 */
export function formatTimestamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}${month}${day}_${hours}${minutes}`;
}

/**
 * 生成可读时间，形如 2026-06-02 10:21，用于历史任务列表展示。
 */
export function formatDateTime(input: number | Date = new Date()): string {
  const date = typeof input === "number" ? new Date(input) : input;
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
