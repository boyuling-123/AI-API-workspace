// 第一批强制卡点 - 压测项4：通用 Task Runner 高并发 + 取消混合场景。
// 验证目标：
//   1. 高并发下并发上限严格不被突破（无泄漏）。
//   2. 取消时：已发出任务能响应 signal 中断，排队任务全部 skipped（清空排队）。
//   3. 所有 outcome 都有确定状态（fulfilled/rejected/skipped），无 undefined（状态统一）。
//   4. 大规模任务在合理时间内结束，不卡死。

async function runWithPool({ items, concurrency, runOne, onProgress, signal }) {
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const outcomes = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
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
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return outcomes;
}

function assert(condition, message) {
  if (!condition) {
    console.error("❌ FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("✅ PASS:", message);
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 压测1：大规模高并发，并发上限严格不被突破，全部完成无泄漏。
async function stressHighConcurrencyNoLeak() {
  const totalTasks = 2000;
  const concurrency = 10;
  const items = Array.from({ length: totalTasks }, (_, index) => index);

  let activeWorkers = 0;
  let peakActiveWorkers = 0;
  let completedCount = 0;

  const startTime = Date.now();
  const outcomes = await runWithPool({
    items,
    concurrency,
    runOne: async (item) => {
      activeWorkers += 1;
      peakActiveWorkers = Math.max(peakActiveWorkers, activeWorkers);
      await delay(1);
      activeWorkers -= 1;
      completedCount += 1;
      return item;
    },
  });
  const elapsedMs = Date.now() - startTime;

  assert(
    peakActiveWorkers <= concurrency,
    `高并发(${totalTasks}任务)并发峰值不超上限 ${concurrency}（实测峰值 ${peakActiveWorkers}）`
  );
  assert(
    completedCount === totalTasks && outcomes.length === totalTasks,
    `全部 ${totalTasks} 任务执行完毕无泄漏（完成 ${completedCount}）`
  );
  assert(activeWorkers === 0, `结束后无残留运行任务（残留 ${activeWorkers}）`);
  assert(elapsedMs < 30_000, `大规模任务在合理时间内结束不卡死（耗时 ${elapsedMs}ms）`);
}

// 压测2：高并发执行中途取消，验证中断已发 + 清空排队 + 状态统一。
async function stressCancelMidFlight() {
  const totalTasks = 1000;
  const concurrency = 10;
  const items = Array.from({ length: totalTasks }, (_, index) => index);
  const controller = new AbortController();

  let startedCount = 0;
  let abortedDetectedCount = 0;

  const poolPromise = runWithPool({
    items,
    concurrency,
    signal: controller.signal,
    runOne: async (item, signal) => {
      startedCount += 1;
      await delay(10);
      if (signal.aborted) {
        abortedDetectedCount += 1;
        throw new Error("aborted-by-signal");
      }
      return item;
    },
  });

  // 让首批任务发出后再取消，模拟运行中途点「取消」。
  await delay(25);
  controller.abort();
  const outcomes = await poolPromise;

  const skipped = outcomes.filter((o) => o && o.status === "skipped").length;
  const rejected = outcomes.filter((o) => o && o.status === "rejected").length;
  const fulfilled = outcomes.filter((o) => o && o.status === "fulfilled").length;
  const undefinedCount = outcomes.filter((o) => o === undefined).length;

  assert(skipped > 0, `取消后大量排队任务被跳过/清空排队（skipped=${skipped}）`);
  assert(
    abortedDetectedCount > 0 || rejected > 0,
    `取消能中断已发出任务（已发=${startedCount}, 检测到中断=${abortedDetectedCount}, rejected=${rejected}）`
  );
  assert(
    undefinedCount === 0,
    `所有 ${totalTasks} 个 outcome 状态统一无 undefined（fulfilled=${fulfilled}, rejected=${rejected}, skipped=${skipped}）`
  );
  assert(
    fulfilled + rejected + skipped === totalTasks,
    `状态计数完整覆盖全部任务（${fulfilled}+${rejected}+${skipped}=${fulfilled + rejected + skipped}）`
  );
}

// 压测3：取消前已完成的任务保留 fulfilled，取消不污染已成功状态。
async function stressCancelPreservesDone() {
  const totalTasks = 200;
  const concurrency = 5;
  const items = Array.from({ length: totalTasks }, (_, index) => index);
  const controller = new AbortController();

  const poolPromise = runWithPool({
    items,
    concurrency,
    signal: controller.signal,
    runOne: async (item, signal) => {
      await delay(5);
      if (signal.aborted) throw new Error("aborted");
      return item;
    },
  });

  await delay(40); // 先让一部分任务完成
  controller.abort();
  const outcomes = await poolPromise;

  const fulfilled = outcomes.filter((o) => o && o.status === "fulfilled").length;
  assert(
    fulfilled > 0,
    `取消前已完成任务保留 fulfilled 状态不被污染（fulfilled=${fulfilled}）`
  );
}

async function main() {
  console.log("=== Task Runner 高并发+取消 压测（强制卡点 压测项4）===");
  await stressHighConcurrencyNoLeak();
  await stressCancelMidFlight();
  await stressCancelPreservesDone();
  console.log("=== 压测完成 ===");
  if (process.exitCode === 1) {
    console.log("结论：存在 FAIL 项，未通过。");
  } else {
    console.log("结论：全部 PASS，压测项4（Task Runner 高并发+取消）达标。");
  }
}

main();
