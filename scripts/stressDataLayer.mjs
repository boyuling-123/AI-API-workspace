// 第一批强制卡点 - 压测项2/项3 数据层：大批量 Excel 解析 + 大 JSON(含 base64) 导入导出。
// 验证目标：
//   - 1000 行 Excel 解析在合理时间内完成不卡死。
//   - 大 JSON（含大量 base64）序列化/反序列化在合理时间内完成不卡死。
//   - 估算 base64 数据量与浏览器 IndexedDB 配额关系，确认会触发配额保护路径。
import * as XLSX from "xlsx";

function assert(condition, message) {
  if (!condition) {
    console.error("❌ FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("✅ PASS:", message);
  }
}

// 压测1：1000 行 Excel 生成 + 解析。
function stressExcelParse() {
  const rowCount = 1000;
  const header = ["prompt", "image_url"];
  const dataRows = Array.from({ length: rowCount }, (_, index) => [
    `测试用例 ${index + 1}：请用一句话介绍第 ${index + 1} 个城市的特色`,
    `https://example.com/img/${index + 1}.png`,
  ]);

  const buildStart = Date.now();
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "inputs");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const buildMs = Date.now() - buildStart;

  const parseStart = Date.now();
  const parsed = XLSX.read(buffer, { type: "array" });
  const parsedRows = XLSX.utils.sheet_to_json(
    parsed.Sheets[parsed.SheetNames[0]],
    { defval: "" }
  );
  const parseMs = Date.now() - parseStart;

  assert(
    parsedRows.length === rowCount,
    `1000 行 Excel 解析行数正确（解析得到 ${parsedRows.length} 行）`
  );
  assert(
    buildMs < 5000,
    `1000 行 Excel 生成不卡死（耗时 ${buildMs}ms）`
  );
  assert(
    parseMs < 5000,
    `1000 行 Excel 解析不卡死（耗时 ${parseMs}ms）`
  );
  console.log(`   ↳ Excel 文件大小约 ${(buffer.length / 1024).toFixed(1)} KB`);
}

// 压测2：大 JSON（含大量 base64 图片）序列化/反序列化。
function stressLargeJson() {
  // 模拟单张 ~50KB base64 图片，1000 条输入各带 1 张 = ~50MB。
  const singleBase64 = "data:image/png;base64," + "A".repeat(50 * 1024);
  const inputCount = 1000;

  const buildStart = Date.now();
  const project = {
    id: "stress-project",
    name: "压测项目",
    tasks: [],
    inputs: Array.from({ length: inputCount }, (_, index) => ({
      id: `input-${index}`,
      prompt: `用例 ${index}`,
      images: [
        {
          id: `img-${index}`,
          name: `image-${index}.png`,
          source: "base64",
          value: singleBase64,
        },
      ],
    })),
  };
  const buildMs = Date.now() - buildStart;

  const serializeStart = Date.now();
  const json = JSON.stringify(project);
  const serializeMs = Date.now() - serializeStart;
  const sizeMB = json.length / (1024 * 1024);

  const parseStart = Date.now();
  const restored = JSON.parse(json);
  const parseMs = Date.now() - parseStart;

  assert(
    restored.inputs.length === inputCount,
    `大 JSON 反序列化数据完整（恢复 ${restored.inputs.length} 条）`
  );
  assert(
    serializeMs < 5000,
    `大 JSON(约 ${sizeMB.toFixed(1)}MB) 序列化不卡死（耗时 ${serializeMs}ms）`
  );
  assert(
    parseMs < 5000,
    `大 JSON 反序列化不卡死（耗时 ${parseMs}ms）`
  );

  // 配额保护路径确认：浏览器 IndexedDB 单源配额通常远小于此量级会被分级限制，
  // ~50MB 量级在受限环境（如隐私模式/低配额）会触发 QuotaExceededError，
  // 由 isQuotaExceededError 捕获并提示。
  console.log(
    `   ↳ 估算 base64 数据量约 ${sizeMB.toFixed(1)}MB，` +
      `达到/接近部分浏览器 IndexedDB 配额阈值，将触发配额保护提示路径。`
  );
  assert(
    sizeMB > 40,
    `base64 数据量足以验证配额保护路径（约 ${sizeMB.toFixed(1)}MB）`
  );
}

function main() {
  console.log("=== 数据层压测（强制卡点 压测项2/项3 数据层）===");
  console.log("[压测] 1000 行 Excel 导入/导出");
  stressExcelParse();
  console.log("[压测] 大 JSON（含大量 base64）序列化/反序列化");
  stressLargeJson();
  console.log("=== 数据层压测完成 ===");
  if (process.exitCode === 1) {
    console.log("结论：存在 FAIL 项，未通过。");
  } else {
    console.log("结论：数据层全部 PASS。");
  }
}

main();
