// 生成批量导入用的假数据 Excel。表头约定：prompt / image_url，其余列作为算法参数(extraFields)。
// 运行：node 测试数据/gen_excel.mjs
import * as XLSX from "xlsx";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function writeSheet(fileName, headerAndRows) {
  const worksheet = XLSX.utils.aoa_to_sheet(headerAndRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "inputs");
  const fullPath = join(here, fileName);
  XLSX.writeFile(workbook, fullPath);
  console.log("已生成:", fullPath, `(${headerAndRows.length - 1} 行数据)`);
}

// 1) 纯文本批量：测大模型文本对比
writeSheet("批量_纯文本_10条.xlsx", [
  ["prompt", "image_url"],
  ["用一句话解释什么是量子纠缠，面向初中生。", ""],
  ["把下面这句改写得更口语化：本产品采用先进工艺制造。", ""],
  ["写一条 38 女王节女装促销的短信文案，30 字内。", ""],
  ["列出 3 个适合新手的 Python 练手项目。", ""],
  ["把“今天天气不错”翻译成英文、日文、法文。", ""],
  ["给一家精品咖啡馆起 5 个有格调的店名。", ""],
  ["用 emoji 表达“我今天很开心去爬山了”。", ""],
  ["解释一下 HTTP 和 HTTPS 的区别，控制在 50 字。", ""],
  ["写一句鼓励熬夜加班同事的话，要温暖不油腻。", ""],
  ["把“尽快回复”换 5 种更礼貌的说法。", ""],
]);

// 2) 含图批量：测多模态模型（图片用公网可访问 URL）
const dog = "https://dashscope.oss-cn-beijing.aliyuncs.com/images/dog_and_girl.jpeg";
const tiger = "https://dashscope.oss-cn-beijing.aliyuncs.com/images/tiger.png";
writeSheet("批量_含图_多模态_6条.xlsx", [
  ["prompt", "image_url"],
  ["图里有什么动物？它在做什么？", dog],
  ["描述这张图的氛围和光线，50 字内。", dog],
  ["图中是什么动物？给它写一句拟人化的内心独白。", tiger],
  ["这张图适合做什么主题的海报？给个标题。", tiger],
  ["找出图里所有的主体并逐一列出。", dog],
  ["如果给这张图配一句古诗，你选哪句？为什么？", tiger],
]);

// 3) 带算法参数批量：测算法 API 混选（额外列 num_images / style 进入 extraFields）
writeSheet("批量_算法参数_文生图_5条.xlsx", [
  ["prompt", "image_url", "num_images", "style"],
  ["一只在星空下打坐的橘猫，国风插画", "", 2, "chinese-ink"],
  ["赛博朋克风格的雨夜街道，霓虹灯", "", 1, "cyberpunk"],
  ["极简扁平风的咖啡品牌 logo", "", 4, "flat"],
  ["水彩风格的江南小镇清晨", "", 2, "watercolor"],
  ["像素风的复古游戏主角站立图", "", 1, "pixel"],
]);

// 4) 脏数据：测健壮性（空行、缺列、超长文本、特殊字符）
writeSheet("批量_脏数据_边界测试.xlsx", [
  ["prompt", "image_url"],
  ["", ""], // 整行空，应触发 warning
  ["只有图没有文字", dog],
  ["带特殊字符的输入：<script>alert(1)</script> & 逗号,引号\"测试", ""],
  ["超长文本：" + "重复内容啊".repeat(60), ""],
  ["   首尾有空格的输入   ", ""],
]);

console.log("\n全部假数据已生成到「测试数据」目录，可在平台「批量导入」里选择导入。");
