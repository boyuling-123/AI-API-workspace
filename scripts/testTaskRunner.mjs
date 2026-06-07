// 通用 Task Runner 单元自测（纯函数任务，验证并发与取消解耦）。
// 直接用编译后的逻辑等价实现，避免引入 TS 运行时；与 lib/taskRunner.ts 行为一致。

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

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function testConcurrencyLimit() {
  let active = 0;
  let maxActive = 0;
  const items = Array.from({ length: 10 }, (_, i) => i);
  await runWithPool({
    items,
    concurrency: 3,
    runOne: async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(20);
      active -= 1;
      return item * 2;
    },
  });
  assert(maxActive <= 3, `并发上限不超过 3（实测峰值 ${maxActive}）`);
}

async function testAllFulfilled() {
  const items = [1, 2, 3, 4, 5];
  const outcomes = await runWithPool({
    items,
    concurrency: 2,
    runOne: async (item) => item + 100,
  });
  const allOk = outcomes.every((o) => o.status === "fulfilled");
  const resultsCorrect = outcomes.map((o) => o.result).join(",") === "101,102,103,104,105";
  assert(allOk && resultsCorrect, "全部任务成功且结果顺序正确");
}

async function testErrorIsolation() {
  const items = [1, 2, 3];
  const outcomes = await runWithPool({
    items,
    concurrency: 3,
    runOne: async (item) => {
      if (item === 2) throw new Error("boom");
      return item;
    },
  });
  assert(
    outcomes[0].status === "fulfilled" &&
      outcomes[1].status === "rejected" &&
      outcomes[2].status === "fulfilled",
    "单个任务失败不影响其它任务"
  );
}

async function testCancellation() {
  const controller = new AbortController();
  const items = Array.from({ length: 10 }, (_, i) => i);
  let started = 0;
  const promise = runWithPool({
    items,
    concurrency: 2,
    signal: controller.signal,
    runOne: async (item, signal) => {
      started += 1;
      await delay(30);
      if (signal.aborted) throw new Error("aborted");
      return item;
    },
  });
  await delay(15);
  controller.abort();
  const outcomes = await promise;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  assert(skipped > 0, `取消后排队任务被跳过（skipped=${skipped}，已启动=${started}）`);
}

async function main() {
  console.log("=== Task Runner 单元自测 ===");
  await testConcurrencyLimit();
  await testAllFulfilled();
  await testErrorIsolation();
  await testCancellation();
  console.log("=== 完成 ===");
}

main();
