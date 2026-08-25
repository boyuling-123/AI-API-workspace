大模型测评平台 PRD · 最终定稿 v1.2
本版在 v1.1 基础上并入：模式切换草稿隔离、批量 image 参数走 URL、评价范围（全量/选中）、Excel 列名唯一性、evaluate 语义明确，并新增第十一章「编程实现注意事项」。

一、项目概述
本地运行的网页工具，供算法工程师调试 prompt、产品/运营对比不同大模型与算法 API 的输出效果。支持单条调试 + Excel 批量处理 + 试运行预览 + AI 逐条评价 + Excel/JSON 导出。

核心特点：

纯本地运行，IndexedDB 自动持久化，刷新/重开数据不丢
JSON 导出/导入做备份与迁移；Excel 导入数据、导出结果
多目标（大模型 + 算法 API）混合并排对比
算法 API 粘贴文档自动接入（解析 → 表单 → 测试）
批量跑前可"试运行"预览效果
AI 逐条自动评价并打分（0–10），支持全量/选中行评价
架构为"未来切换纯前端 + 用户自填 key"预留余地
二、技术栈与架构约束
2.1 技术栈
框架：Next.js 14（App Router）+ TypeScript
UI：Tailwind CSS + shadcn/ui
外部调用：当前全部经 Next.js API 路由，密钥从 .env.local 读，绝不暴露前端
持久化：IndexedDB（dexie）
Excel：xlsx（SheetJS），前端解析与生成
图片压缩：前端 canvas
运行：本地 npm run dev，访问 localhost:3000
不使用：云数据库、云部署、用户登录
2.2 架构约束
(1) 模块化、低耦合：每个功能模块为独立组件，新增小功能只加组件、不动主流程；业务逻辑与 UI 分离（hooks/service）。
(2) 抽象调用层：所有外部调用走 services/llmClient.ts、services/apiClient.ts。当前打到 Next.js API 路由；未来切前端直连只改调用层。⚠️ 未来纯前端直连部分模型受 CORS 限制可能仍需轻量代理。
(3) Key 来源抽象：统一 getApiKey(provider)，当前从 .env.local 读，未来改前端输入只换此处。
(4) 适配器模式：模型用 adapter（非 switch），新增模型=加一个 adapter 文件。
(5) 配置集中：模型列表、并发、超时、body 上限等进 config/。

实施提醒：第一批先搭骨架（调用层 + getApiKey + adapter 骨架），骨架歪了后期难救。

三、数据模型
typescript
const SCHEMA_VERSION = 1;

interface Project {
  id: string;
  version: number;             // = SCHEMA_VERSION
  name: string;
  createTime: number;
  updateTime: number;
  apiConfigs: ApiConfig[];     // 只存定义
  tasks: Task[];
}

interface Task {
  id: string;
  createTime: number;
  finishTime?: number;
  mode: 'single' | 'batch';
  inputs: TaskInput[];
  targetIds: string[];
  concurrency: number;         // 1~10，默认3
  apiParamsSnapshot: {         // 只存定义/列映射，不存值
    targetId: string;
    paramDefs: ParamDef[];
  }[];
  results: ResultRow[];
  evaluation?: Evaluation;
  status: 'idle' | 'running' | 'partial' | 'done' | 'error' | 'cancelled';
}

interface TaskInput {          // 所有“值”都存这里
  id: string;
  prompt: string;
  images: ImageItem[];
  extraFields?: Record<string, any>;   // 算法API参数值（含image参数的URL字符串）
}

interface ImageItem {
  id: string;
  name: string;
  source: 'url' | 'base64';
  value: string;
}

interface ResultRow {
  inputId: string;
  items: ResultItem[];
}

interface ResultItem {
  targetId: string;
  targetName: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'interrupted';
  outputText?: string;
  outputImages?: string[];     // 展示用原图
  latencyMs?: number;
  error?: string;
}

interface ModelConfig {        // config/models.ts 写死
  id: string;
  name: string;
  type: 'llm' | 'multimodal';
  imageInput?: 'url' | 'base64' | 'both';
}

interface ApiConfig {          // 只存定义
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  headers: { key: string; value: string }[];
  inputParams: ParamDef[];
  outputImagePath?: string;
  outputTextPath?: string;
  status: 'unverified' | 'tested_ok' | 'tested_fail';
  rawDoc?: string;
}

interface ParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'image';
  required: boolean;
  desc?: string;
  defaultValue?: any;
  value?: any;   // ⚠️ ApiConfig 中仅占位、无效、不持久化；真值存 TaskInput
}

interface Evaluation {
  userRequirement: string;
  evalPrompt: string;
  evalModelId: string;
  scope?: 'all' | 'selected';          // 评价范围：全量 / 选中行
  selectedInputIds?: string[];         // scope='selected' 时生效
  status: 'idle' | 'running' | 'done' | 'error';
  results?: {
    inputId: string;
    scores: { targetId: string; score: number; comment: string }[];  // 0–10，一位小数
    summary: string;
    recommendation: string;
  }[];
}
核心数据原则：值永远存 TaskInput；定义存 apiParamsSnapshot；绝不把值写回 ApiConfig；单条模式同样遵守（inputs 长度=1）。

四、功能需求
模块 1：顶部工具栏
新建项目（有未导出修改时二次确认）
导入 JSON（校验 version：兼容则还原，不兼容明确提示不强行导入；覆盖前二次确认）
导出 JSON（项目名_YYYYMMDD_HHmm.json）
项目名可重命名；IndexedDB 自动保存，JSON 仅备份/迁移
模块 2：算法 API 接入
粘贴文档 →「智能解析」/api/parse-doc（强制结构化输出，function calling 优先，降级 JSON+容错解析）→ 返回草稿 + warnings
渲染可编辑表单；解析提示区高亮缺失/不确定项
「一键测试」/api/test-api（带诊断）：成功渲染返回、状态 tested_ok；失败展示错误+诊断、状态 tested_fail
输出路径校验：outputImagePath 与 outputTextPath 全空时不许标 tested_ok
通过后存入 apiConfigs；列表支持查看/编辑/删除/重新解析
模块 3：输入区
模式切换：单条 / 批量

模式切换数据处理：单条与批量各自维护独立草稿，切换时不互相清空/覆盖（分开保存于内存/IndexedDB）；切回原模式恢复上次草稿；正式运行只使用当前所在模式的数据生成 Task。

单条模式：

prompt 文本框；图片 Tab 切「本地上传(base64)」「URL」，多张可删
选中算法 API → 自动生成入参表单填值；type:'image' 参数复用图片输入组件
值写入该条 TaskInput（inputs 长度=1）
批量模式（Excel）：

「下载导入模板」：按选中目标所需字段生成空 Excel；列名用固定英文 key（prompt、image_url、参数原始 name）
「导入 Excel」→ 前端可编辑表格（行可查看/编辑/删除），确认再运行；不匹配列给提示
落位：prompt→prompt；image_url→images(source='url')；算法API参数列→extraFields
算法 API 的 type:'image' 参数：批量模式下以 URL 字符串列承载（列名=参数原始 name），存入 TaskInput.extraFields[参数名]（值为 URL 字符串）。即批量模式下所有图片一律走 URL，不支持本地文件。

显示条数预览
模块 4：目标选择
多选：大模型 + 所有 tested_ok 算法 API，支持混合
置灰：有图时 type:'llm' 置灰；图为 base64 但模型 imageInput='url' → 提示改用 URL 或置灰
模块 5：试运行 & 批量运行
并发数运行前可设（1~10，默认3，Task.concurrency），管控批量调用 + AI 评价调用，超出排队
试运行：仅第1条，临时展示、不落历史
批量运行：按并发分批；单调用超时（默认60s）；取消=前端 AbortController（标记 cancelled/interrupted，后端已发请求不保证终止）；运行中刷新→未完成标 interrupted 提示重跑（不做续传）；算法API走 /api/run-api
模块 6：结果对比区
单条：多列卡片并排；批量：表格视图（行可展开）
每结果：目标名+类型标签、状态、输出（文本/图片可放大）、耗时（「1.2s」）、错误
实时更新；部分成败 → status=partial 分别标识
模块 7：AI 评价（逐条）
填测评需求 →「生成评价Prompt」/api/gen-eval-prompt（可编辑）→ 选裁判模型（含图时 type:'llm' 置灰，须 multimodal）
评价范围：默认全量（逐条评价所有输入）；提供**「仅评价选中/可见行」**选项（避免大数据量烧 token），勾选粒度本期支持"全选 / 试运行那条 / 手动勾选行"
「开始评价」→ 对范围内每条调用 /api/evaluate；results 按 inputId 归属；评价并发受 Task.concurrency 管控
逐条语义：每次调用处理一条输入，传入 results[]=该 inputId 下各目标的 ResultItem，裁判横向对比该条各目标输出
图片传输：结果图为 URL → 只传 URL；为 base64 → 前端 canvas 压缩（最长边1024px）后传，原图仍保留展示
展示：各目标评分（0–10）+点评、总体结论、推荐项
模块 8：导出结果（Excel）
每行一条输入，每目标占列；含 AI 评分列
列名唯一性：以 targetId（或保证唯一的展示名）生成，避免重名覆盖；建议列头 {targetName}#{targetId简写}_输出、..._耗时
图片：URL→存链接；base64→存占位文字+提示"建议用 URL 输出查看"（不打包 zip）
文件名 项目名_结果_YYYYMMDD_HHmm.xlsx
模块 9：历史任务
Task 列表（时间倒序），点击完整重现输入/输出/评价；算法API入参由 extraFields + apiParamsSnapshot.paramDefs 还原
五、后端 API 设计
POST /api/chat              调用单个大模型
  入参：{ modelId, prompt, images[] }
  出参：{ outputText, outputImages[], latencyMs }

POST /api/parse-doc         解析文档为 ApiConfig 草稿
  入参：{ doc }   出参：{ apiConfig, warnings[] }
  要点：强制结构化输出（function calling 优先，降级 JSON+容错）

POST /api/test-api          【接入阶段单次测试，带诊断】
  入参：{ apiConfig, paramValues }
  出参：成功 { ok:true, response, extractedImages[], extractedText, latencyMs }
        失败 { ok:false, error, diagnosis }

POST /api/run-api           【批量/试运行正式调用，纯执行不带诊断】
  入参：{ apiConfig, paramValues }   // 来自 TaskInput
  出参：{ status, outputText?, outputImages[], latencyMs, error? }

POST /api/gen-eval-prompt
  入参：{ userRequirement, targetNames[] }   出参：{ evalPrompt }

POST /api/evaluate          【逐条调用：一次处理一条输入】
  入参：{ evalPrompt, evalModelId, inputId, results[] }  // results=该inputId下各目标ResultItem，图片为压缩版或URL
  出参：{ inputId, scores[](0-10), summary, recommendation }
body 上限：相关 Route Handler 配置放大（建议 25MB）。

六、配置
.env.local：各模型 key（用户自填，不提交）
config/models.ts：大模型数组（id/name/type/imageInput）
config/runtime.ts：默认并发(3)、上限(10)、超时(60s)、body上限(25MB)
图床预留：uploadImage 默认关闭，待合规后接 OSS

七、数据存储与持久化规则
IndexedDB 日常自动保存（刷新不丢）；JSON 备份/迁移（带 version 校验）
图片：url 存 url；base64 存完整 base64（展示用原图）
base64 传大模型前前端 canvas 压缩（最长边1024px）
文件名：JSON 项目名_YYYYMMDD_HHmm.json；Excel 项目名_结果_YYYYMMDD_HHmm.xlsx
八、明确不做（本期外）
用户登录/云数据库/云部署、图床上线（仅预留）、批量本地图片、断点续传、图片生成数量选择、JSON轻量导出、Excel图片打包zip、纯前端直连（仅架构预留）

九、验收标准
理想路径： 启动正常；单条混合多目标对比+耗时；批量(模板→填→导入→可编辑表格→试运行→设并发→运行→表格)；文档解析→表单→测试；AI逐条评价(评分+结论按inputId)；Excel导出正常；JSON刷新后完整还原；IndexedDB刷新不丢。

异常路径（必测）： 解析失败提示；测试失败诊断；部分成败标识partial；大JSON/大base64不卡死；版本不兼容提示；含图置灰与base64+仅URL模型提示；运行中刷新标interrupted；输出路径全空不许tested_ok；base64评价传压缩版原图仍展示；取消标cancelled且清空排队；模式切换草稿不丢；Excel重名目标列不覆盖；评价范围选中行只评选中条。

十、实施建议（分两批）
第一批（骨架+核心）： 项目骨架(Next+Tailwind+shadcn+dexie)；架构骨架先行(调用层+getApiKey+adapter骨架+config)；IndexedDB+JSON导入导出+version；输入区(单条+批量Excel+模板+可编辑表格+模式草稿隔离)；目标选择+置灰；可调并发+试运行+批量运行(分批/超时/取消/刷新中断)；结果区+耗时；Excel导出(列名唯一)；历史任务。

第二批： 算法API接入(parse-doc/test-api/run-api/表单/输出路径校验)；AI逐条评价(gen-eval-prompt/evaluate/评价范围/base64压缩传裁判)。

十一、编程实现注意事项（交付给编程 agent）
IndexedDB 写入策略：批量结果逐条返回时，不要每条立即整对象写库；用 debounce/批量提交，避免频繁 IO 卡顿。
存储配额预期：大量 base64 可能触及浏览器配额（数百 MB~1GB）；本期不主动处理，但须捕获写入失败并提示（"存储空间不足，建议改用 URL 图片或导出备份"）。
取消要清空排队：取消时，已发出请求中断 + 排队中未发出任务一并清除，状态统一 cancelled/interrupted。
试运行结果隔离：仅结果区临时展示，不写历史 Task，状态与正式运行隔离，勿串台。
adapter 输出归一化：各模型 adapter 必须归一为 { outputText, outputImages[], latencyMs }；上层组件不得出现按 modelId 的 if-else，差异全收敛在 adapter 内。
Next.js 14 App Router body 上限写法：用 App Router(Route Handler)对应写法(route segment config/手动读流)，勿照搬 Pages Router 的 api.bodyParser。
Excel 类型转换：SheetJS 读出类型可能与 ParamDef.type 不符(number读成string等)；导入时按 paramDef.type 强制转换+校验，失败行给提示。
base64 压缩位置：canvas 压缩在前端完成后再传后端评价；只压"传给裁判的副本"，结果区与存储保留原图。