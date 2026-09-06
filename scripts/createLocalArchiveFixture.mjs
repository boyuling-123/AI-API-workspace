import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

// Synthetic only. The browser test server never connects to the user's archive.
const root = path.resolve("test-results/archive-fixture");
await mkdir(path.join(root, "data/records"), { recursive: true });
const canonical = await realpath(root);
const groups = [Array.from({ length: 62 }, (_, i) => ({
  id: `synthetic-${i}`, type: i % 2 === 0 ? "跑批结果" : "失败记录", model: "synthetic-private-model",
  status: i % 2 === 0 ? "success" : "timeout", prompt: `合成输入 ${i + 1} <script>not-executed</script>`,
  output: i === 0 ? "合成输出，仅用于测试" : "", reason: "合成说明", source: "/synthetic/private/source.txt",
  evidenceHash: "a".repeat(64), lineNo: i + 1, images: ["https://invalid.example/never-load.png"],
})), [{ id: "synthetic-0", type: "Judge 结果", model: "synthetic-private-model", status: "success", prompt: "", output: "" }]];
const recordShards = [];
for (const [index, rows] of groups.entries()) {
  const file = `records-${String(index).padStart(4, "0")}.js`;
  const text = `window.PORTABLE_RECORD_SHARDS=window.PORTABLE_RECORD_SHARDS||{};window.PORTABLE_RECORD_SHARDS[${JSON.stringify(file)}]=${JSON.stringify(rows)};`;
  await writeFile(path.join(canonical, "data/records", file), text);
  recordShards.push({ file, count: rows.length, bytes: Buffer.byteLength(text) });
}
await writeFile(path.join(canonical, "data/manifest.json"), JSON.stringify({ recordShards, recordCounts: { staleTotal: 64 } }));
await writeFile(path.join(canonical, "source.json"), JSON.stringify({ root: canonical, provenance: "synthetic" }));
