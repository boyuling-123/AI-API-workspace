// 生成 1000 行压测用 Excel，供 browser-use 导入测试 UI 渲染不卡死。
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";

const rowCount = 1000;
const header = ["prompt", "image_url"];
const dataRows = Array.from({ length: rowCount }, (_, index) => [
  `压测用例 ${index + 1}：请用一句话介绍第 ${index + 1} 个主题`,
  "",
]);

const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "inputs");
const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

const outputPath = "/tmp/stress-1000.xlsx";
writeFileSync(outputPath, buffer);
console.log(`已生成 ${rowCount} 行压测 Excel：${outputPath}`);
