# 评测平台 · AI 开发交接文档

> 用途：把本批次 AI 协助开发完成的所有能力、改动位置、架构链路、踩过的坑、以及尚未动手的迭代需求，一次性交接给下一个模型/开发者。看完这份就能无缝接手，不必再翻聊天记录。
> 最后更新：2026-06-04

---

## 0. 30 秒速览（新模型必读）

- **项目**：本地运行的大模型/算法 API 评测平台。输入（文本/图片）→ 多目标并排跑 → 结果对比 → AI 逐条评价打分 → 导出 Excel/JSON。
- **技术栈**：Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + IndexedDB(dexie) + xlsx。本地 `npm run dev` 跑在 `localhost:3000`。
- **权威文档**：`测评平台prd.md`（v1.2 定稿，数据模型/功能/API 全在里面）。本文件是它的「实现态补充 + 交接」。
- **当前状态**：PRD 两批功能基本落地；本批次额外做了「多模态真发图片」「可编辑内置算法」「UI 重构（Tab + 抽屉）」等增强；正在**讨论但未动手**的是「生图 + LoRA」迭代。
- **调用真相**：平台是**纯调度器**，自己不跑模型、没有 GPU，全部调第三方 API。这点决定了 LoRA 方案的可行性边界（见第 5 章）。

---

## 1. 架构与关键链路（改代码前先看懂这张图）

### 1.1 五条核心原则（PRD 第二章的落地约束，务必延续）

1. **抽象调用层**：所有外部调用走 `services/llmClient.ts`、`services/apiClient.ts`，组件不直接 fetch。
2. **Key 来源抽象**：密钥统一从 `.env.local` 读，经 Next.js API 路由转发，**绝不暴露到前端**。
3. **适配器模式**：每个大模型一个 adapter 文件，新增模型 = 加一个 adapter + 注册，**禁止在上层写 `if (modelId === ...)`**。
4. **结果归一化**：所有 adapter / 算法 API 的返回都归一为 `{ outputText, outputImages[], latencyMs }`，对比区只认这个结构。
5. **值与定义分离**：所有「值」存 `TaskInput`（含算法参数值 `extraFields`、图片 `images`）；「定义」存 `ApiConfig` / `apiParamsSnapshot`，**绝不把值写回 ApiConfig**。

### 1.2 大模型调用链路

```
组件 → services/llmClient.ts → POST /api/chat (route.ts)
     → adapters/registry.ts 按 modelId 取 adapter
     → adapter 组装 Anthropic 兼容请求体（含图片 block）
     → DashScope Anthropic 网关 (dashscopeBaseUrl)
     → adapter 解析归一为 {outputText, outputImages[], latencyMs}
```

### 1.3 算法 API 调用链路

```
组件 → services/apiClient.ts(runAlgorithmApi) → POST /api/run-api (route.ts)
     → services/algoClient.ts(buildPayload) 按 ParamDef 校验+组装请求体
     → 用户的第三方算法 API
     → 按 outputImagePath/outputTextPath 抽取结果并归一
```

### 1.4 算法 API「文档自动接入」链路

```
粘贴文档 → ApiDocParser.tsx → POST /api/parse-doc（大模型结构化解析）
        → 返回 ApiConfig 草稿 + warnings
        → apiConfigFromParse.ts 转成表单可编辑结构
        → ApiConfigForm.tsx 人工确认 → 一键测试 /api/test-api → 保存
```

### 1.5 AI 评价链路

```
EvaluationPanel.tsx → /api/gen-eval-prompt 生成评价Prompt（可编辑）
   → 逐条 /api/evaluate（一次一条输入，横向对比该条各目标）
   → 含图：base64 在前端 canvas 压缩后才发裁判，原图仍展示/存储
```

---

## 2. 本批次已完成的 AI 开发能力清单

> 以下是在 PRD v1.2 骨架之上，本批次 AI 协助新增/增强的能力，按主题归类。

### 2.1 多模态「真发图片」能力（核心增强）

- **背景**：原先模型只发文本，多模态评测时图片没真正传给模型。本批次打通了图片 block 真实发送。
- **做了什么**：
  - `models.ts`：新增 `qwen3.6-plus`（multimodal, imageInput `both`）作为多模态范例模型；`kimi-k2.6` 由 llm 改为 `multimodal`；`deepseek-v4-pro` 保持纯文本 llm。
  - 新增 `adapters/qwenAdapter.ts` 并注册到 `adapters/registry.ts`（现注册：deepseek、moonshot、qwen 三个）。
  - `adapters/anthropicCompatible.ts`：把图片拼进 content 的 image block，支持两种格式（已实测通过）：
    - URL 图：`{type:"image", source:{type:"url", url}}`
    - base64 图：`{type:"image", source:{type:"base64", media_type:"image/jpeg", data}}`
  - 网关：`runtime.ts` 的 `dashscopeBaseUrl = https://dashscope.aliyuncs.com/apps/anthropic`。
- **实测结论**：qwen3.6-plus 多模态 OK、kimi-k2.6 多模态 OK、deepseek-v4-pro 纯文本 OK。

### 2.2 多模态目标置灰 / 含图可选逻辑修复

- `models.ts` 的 `getModelImageCapability(modelId)`：未登记或非 multimodal 的模型一律视为不支持图片。
- `WorkspaceBody.tsx`：修复了原先 `MULTIMODAL_MODEL_IDS` 是空集合导致多模态判断失效的 bug（详见第 4 章坑 1）。
- `TargetSelector.tsx`：含图输入时，纯文本模型置灰；base64 图遇到只支持 url 的模型给提示；多模态含图目标可正常勾选。

### 2.3 内置算法可编辑

- `builtinAlgos.ts`：内置算法默认配置；默认模型配置由 `MODELS` 自动生成，新增模型无需改这里。
- 配套对 `ApiConfigForm.tsx` / `ApiAccessPanel.tsx` 做了可查看/编辑/重新解析的打通。

### 2.4 UI 重构：Tab + 抽屉 + 可折叠面板

- 新增 `hooks/useTheme.ts`、`components/layout/AppTabs.tsx`、`components/layout/Drawer.tsx`、`components/layout/CollapsiblePanel.tsx`。
- 思路：把「配置」和「结果」拆成 Tab；不常用功能（AI 评价配置、接口接入、文档解析）改成按钮/开关弹出抽屉，常用露出、不常用收起。

### 2.5 测试数据（对接文档样本）

- `测试数据/` 下准备了 5 份风格各异的对接文档样本（标准算法 API 文生图、大模型对话、不规范口语、英文 OpenAPI 风格、刁钻多接口混杂）+ `gen_excel.mjs` 生成批量 Excel，用于测平台的文档解析与批量能力。
- 注意：之前用户要求**删掉对接文档相关的内置测试数据**，新增数据时不要再混进这类内容。

### 2.6 端到端验证脚本（browser-use）

- `~/Desktop/browser-use-runner/` 下有 `verify_ui_v2.py`、`verify_editable_builtin.py`、`verify_vision.py`，用浏览器自动化验证 UI、可编辑内置算法、多模态含图评测。

---

## 3. 关键文件地图（改哪个功能去哪个文件）

### 配置层 `src/config/`
- `models.ts` — 内置大模型列表 + `getModelConfig` / `getModelImageCapability`。新增模型先动这里。
- `runtime.ts` — 并发(3)/上限(10)/超时(60s)/body上限/`dashscopeBaseUrl`。
- `builtinAlgos.ts` — 内置算法默认配置。

### 适配器层 `src/adapters/`
- `registry.ts` — adapter 注册表，新模型 adapter 在此登记。
- `types.ts` — `LlmAdapter` 接口定义。
- `anthropicCompatible.ts` — Anthropic 兼容请求体组装（含图片 block），多家共用。
- `deepseekAdapter.ts` / `moonshotAdapter.ts` / `qwenAdapter.ts` — 各模型 adapter。

### 服务层 `src/services/`
- `llmClient.ts` — 大模型调用入口（前端侧）。
- `apiClient.ts` — 算法 API 调用入口（`runAlgorithmApi`，转发 `/api/run-api`）。
- `algoClient.ts` — `buildPayload` 按 ParamDef 校验组装请求体（**LoRA 参数透传将动这里**）。
- `runService.ts` — 跑批调度（并发池/取消/中断）。
- `excel.ts` — Excel 导入导出。
- `projectFactory.ts` — Project/Task 工厂。

### 后端路由 `src/app/api/`
- `chat/route.ts` — 大模型对话。
- `run-api/route.ts` — 算法 API 正式执行。
- 另有 `parse-doc` / `test-api` / `gen-eval-prompt` / `evaluate`（见 PRD 第五章）。

### 组件层 `src/components/`
- `WorkspaceBody.tsx` — 工作区主体（模式切换 / 多模态判断）。
- `TargetSelector.tsx` — 目标选择 + 置灰逻辑。
- `input/AlgoParamsInput.tsx` — 单条算法参数表单（`collectExtraParams` → `extraFields`，**LoRA 上传 UI 大概率加这里**）。
- `api/ApiDocParser.tsx` / `api/ApiConfigForm.tsx` / `api/ApiAccessPanel.tsx` — 接口接入三件套。
- `evaluation/EvaluationPanel.tsx` — AI 评价。
- `result/ResultCard.tsx` / `ResultTable.tsx` / `resultShared.tsx` — 结果展示。
- `run/RunPanel.tsx` — 运行控制。
- `layout/AppTabs.tsx` / `Drawer.tsx` / `CollapsiblePanel.tsx` — 布局骨架。

### 类型 `src/types/index.ts`
- 全量数据模型（与 PRD 第三章一致）。`ParamDef.type` 目前只有 `string|number|boolean|image`。
- `ModelConfig.type`: `"llm" | "multimodal"`；`imageInput?: "url" | "base64" | "both"`。
- `ImageItem`: `{ id, name, source: "url"|"base64", value }`。

---

## 4. 踩过的坑 / 易错点（避免重复犯）

1. **`MULTIMODAL_MODEL_IDS` 空集合 bug**（`WorkspaceBody.tsx`）：曾用一个空的硬编码集合判断模型是否多模态，导致所有多模态判断恒为 false、图片永远发不出去。已改为以 `models.ts` 的 `type === "multimodal"` / `getModelImageCapability` 为准。**新增多模态判断逻辑一律走 config，不要再维护硬编码 id 集合。**

2. **图片 block 格式**：DashScope Anthropic 网关对 url / base64 是两套 source 结构（见 2.1）。base64 必须带 `media_type`。这是实测出来的，别凭印象改。

3. **值不要写回 ApiConfig**：`ParamDef.value` 在 ApiConfig 里只是占位、不持久化；真值永远存 `TaskInput.extraFields`。LoRA 参数也必须遵守这条。

4. **adapter 必须归一化输出**：上层组件严禁按 modelId 写分支，差异全部收敛进 adapter，否则对比区会乱。

5. **Excel 类型转换**：SheetJS 读出的类型可能与 `ParamDef.type` 不符（number 读成 string）。导入时按 paramDef.type 强制转换+校验。

6. **base64 压缩位置**：只压「传给裁判的副本」，结果区与存储保留原图。别在源头压。

7. **取消要清空排队**：取消时已发请求中断 + 未发任务清除，状态统一 `cancelled/interrupted`。

8. **测试数据别混对接文档**：用户明确要求删掉内置的对接文档测试数据，后续造数据不要再加这类。

---

## 5. 进行中的迭代需求：生图 + LoRA（尚未动手，重点交接）

> 状态：**纯需求讨论阶段，未写任何代码**。用户原话"我们先聊聊需求 先不动手"。下一个模型接手时是来继续「聊需求 / 定方案」的，不要直接开干。

### 5.1 用户想要什么（按用户原话还原）

- 场景：批量跑批的**生图场景**，希望用 `prompt + LoRA + 生图模型` 批量跑图。
- 形态：**不做独立模式**。在网页首页把维度拆成两组平级选项：
  - 「单次 / 批量」是一组；
  - 「纯文本 / 生图」是另一组。
- LoRA 怎么进：在**生图模式**下新增 LoRA 选项；用户**上传本地 LoRA 文件**后，就能用该 LoRA + 生图模型生图。
- 置灰联动：LoRA 能力**挂在「模型/算法选择」上**——用户上传了 LoRA 后，**不支持 LoRA 的模型自动置灰**，支持的才可选。
- 参照物：用户说"我记得 ComfyUI 上要用 LoRA 得选择本地的 LoRA 文件"，所以希望"让用户把 LoRA 文件拖进去"。

### 5.2 关键技术争议点（必须先和用户对齐，否则方案无从落地）

> 这是上一轮卡住的地方，也是新模型开聊要先解决的核心问题。

- **平台是纯调度器，没有 GPU、不跑模型。** 所有生图都是调第三方 API。
- ComfyUI 里说的"本地 LoRA 文件"指的是 **ComfyUI 服务器本地磁盘上的文件**（由 `LoraLoader` 节点按文件名加载），**不是用户浏览器本地的文件**。
- 所以"把 LoRA 文件拖进网页"这个交互，能不能成立，**取决于用户实际调用的生图服务是哪一种**：
  - **(A) 用户自建/可控的 ComfyUI 实例**：平台需要先把用户拖入的 LoRA 文件上传到 ComfyUI 所在机器（或其可访问的存储），再在 workflow 里按文件名引用。涉及文件上传通道 + ComfyUI `/prompt` API + workflow JSON 模板。
  - **(B) 封装好的云生图 API**：要看该 API 是否开放 LoRA 入参，以及接收形式（LoRA 名称/ID、还是 LoRA 文件 URL、还是 multipart 上传）。如果云 API 根本不收用户自定义 LoRA 文件，"拖文件"方案不成立，只能退化为"填 LoRA 名称/ID"。

### 5.3 还没问清楚的问题（开聊清单）

1. 你实际调用的生图服务是 **自建 ComfyUI 实例** 还是 **封装好的云 API**？（决定整个方案可行性）
2. 若是 ComfyUI：调用方式是 `/prompt` API + workflow JSON 吗？平台能否访问到它的文件系统/上传接口？
3. LoRA 传递形式：**文件**（需上传通道）/ **URL** / **名称或 ID**？
4. LoRA 作用范围：**全局一个**（整批共用）/ **每条输入各自指定** / **多个 LoRA 叠加**？
5. 是否需要 **LoRA 权重**（lora_scale）？是否要把 LoRA 当**评测变量**（多 LoRA 笛卡尔积跑批对比）？

### 5.4 现有机制对 LoRA 的支撑评估（已分析过的结论）

- **单个 LoRA（名称/ID + 权重）作为普通参数透传**：现有链路天然支持。走 `AlgoParamsInput` → `extraFields` → `algoClient.buildPayload` → 请求体即可，不用大改。
- **多个 LoRA 组合 / 数组结构**：当前 `ParamDef.type` 只有 `string|number|boolean|image`，**不支持数组/JSON**。要支持多 LoRA 叠加需给 `ParamDef` 加 JSON/数组类型，并改 `buildPayload`。
- **LoRA 作为评测变量（笛卡尔积跑批）**：现有跑批是「每条输入 × 每个目标」，没有「参数变量展开」概念，属于**新增能力**，要动 `runService` 的任务展开逻辑。
- **拖入本地 LoRA 文件**：现有 `ImageItem` 只处理图片（url/base64）。LoRA 是模型权重文件（几十~几百 MB），**不适合走 base64 进 IndexedDB**，必须有独立的文件上传通道到 GPU/服务端，这是现有架构没有的部分。

### 5.5 给新模型的建议谈法

先用 5.3 的清单把"生图服务类型"问清楚，再分支：
- 如果是云 API 且不收自定义 LoRA 文件 → 把需求收敛为「LoRA 名称/ID + 权重参数化」，几乎零架构改动。
- 如果是可控 ComfyUI → 需要规划「文件上传 → ComfyUI 存储 → workflow 引用」的新链路，工作量较大，要单独立方案。
- "纯文本/生图"模式切换 + 生图目标置灰，可以先于 LoRA 落地，作为前置 UI 改造。

---

## 6. 环境与运行

- **启动**：项目根目录 `npm run dev`，访问 `http://localhost:3000`。
- **密钥**：`.env.local` 配置 `DASHSCOPE_API_KEY`（两个内置模型共用，走 DashScope Anthropic 网关）。`.env.local` 不提交。
- **网关地址**：`config/runtime.ts` 的 `dashscopeBaseUrl = https://dashscope.aliyuncs.com/apps/anthropic`。
- **持久化**：IndexedDB 自动保存（刷新不丢）；JSON 仅用于备份/迁移（带 version 校验）。
- **端到端验证**：`~/Desktop/browser-use-runner/` 下的 verify 脚本（需先起 dev server）。

### 配套文档索引
- `测评平台prd.md` — 权威 PRD v1.2（数据模型 / 功能 / API 全量定义）。
- `测评平台开发计划.md` / `测评平台需求增补v2.md` — 计划与增补。
- `项目复盘-难点与卡点.md` — 面向「讲项目/汇报」的复盘（非开发交接用途）。
- `这个网站能干啥.md` — 面向用户的能力介绍。
- 本文件 `AI开发交接文档.md` — 面向开发接手的实现态交接。

---

## 7. 给下一个模型的一句话

PRD 已定稿、两批功能已落地、本批次又补了多模态真发图 + 可编辑内置算法 + UI 重构。**现在唯一悬而未决的是「生图 + LoRA」的需求方案**——它卡在"用户的生图服务到底是 ComfyUI 还是云 API"这个前置问题上（第 5 章）。你接手后请先用 5.3 清单和用户对齐，再谈实现，**不要在没确认服务类型前就动代码**。
