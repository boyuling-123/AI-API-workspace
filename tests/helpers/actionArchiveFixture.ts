import { mkdtemp, mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function actionArchiveFixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "eval-action-fixture-")));
  await mkdir(path.join(root, "data/records"), { recursive: true });
  const file = "records-0000.js";
  const rows = [
    { id: "synthetic-id", type: "跑批结果", model: "synthetic-private-model", prompt: "synthetic-private-input", output: "synthetic-private-output" },
    { id: "synthetic-id", type: "Judge 结果", prompt: "synthetic-private-input" },
  ];
  const bytes = Buffer.from(`window.PORTABLE_RECORD_SHARDS=window.PORTABLE_RECORD_SHARDS||{};window.PORTABLE_RECORD_SHARDS["${file}"]=${JSON.stringify(rows)};`);
  const shard = path.join(root, "data/records", file);
  await writeFile(shard, bytes);
  await writeFile(path.join(root, "data/manifest.json"), JSON.stringify({ recordShards: [{ file, count: 2, bytes: bytes.length }], recordCounts: { total: 2 } }));
  const config = path.join(root, "source.json");
  await writeFile(config, JSON.stringify({ root, provenance: "synthetic" }));
  return { root, config, shard, bytes };
}
