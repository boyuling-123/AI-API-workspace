export interface RunWithPoolParams<TItem, TResult> {
  items: TItem[];
  concurrency: number;
  runOne: (item: TItem, signal: AbortSignal) => Promise<TResult>;
  onProgress?: (result: TResult, item: TItem, index: number) => void;
  signal?: AbortSignal;
}

export interface PoolItemOutcome<TResult> {
  status: "fulfilled" | "rejected" | "skipped";
  result?: TResult;
  error?: unknown;
}

/**
 * 通用受控并发池：与具体业务解耦，M4 批量调用与 M9 评价调用共用。
 * - 并发上限内池化执行，超出排队。
 * - 取消（signal.abort）时：不再启动排队中的任务（标 skipped），已发出的任务由 runOne 自行响应 signal 中断。
 * - 每个任务完成（成功/失败）即触发 onProgress，实现实时更新。
 */
export async function runWithPool<TItem, TResult>(
  params: RunWithPoolParams<TItem, TResult>
): Promise<PoolItemOutcome<TResult>[]> {
  const { items, concurrency, runOne, onProgress, signal } = params;

  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const outcomes: PoolItemOutcome<TResult>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }

      if (signal?.aborted) {
        outcomes[currentIndex] = { status: "skipped" };
        continue;
      }

      const item = items[currentIndex];
      try {
        const result = await runOne(item, signal ?? new AbortController().signal);
        outcomes[currentIndex] = { status: "fulfilled", result };
        onProgress?.(result, item, currentIndex);
      } catch (error) {
        outcomes[currentIndex] = { status: "rejected", error };
      }
    }
  }

  const workerCount = Math.min(safeConcurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return outcomes;
}
