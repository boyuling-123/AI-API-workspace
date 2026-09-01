import type {
  EvaluationEvidence,
  EvaluationImageEvidenceSource,
  EvaluationRecord,
  EvaluationReviewEvent,
  EvaluationTextEvidenceSource,
  EvaluatorVersion,
  ResultItem,
  Task,
} from "@/types";
import {
  buildEvaluationLeaderboard,
  type EvaluationLeaderboard,
} from "@/lib/evaluationLeaderboard";
import { isEvaluationReviewEventIntact } from "@/lib/evaluationReview";
import { isEvaluatorVersionIntact } from "@/lib/evaluatorVersion";
import { redactSensitiveText } from "@/lib/redactSensitive";

export const EVALUATION_HTML_REPORT_SCHEMA =
  "lu-evaluation-html-report/v1";

export type ReportEvaluatorVersionStatus =
  | "verified"
  | "unbound"
  | "missing"
  | "corrupt";

export interface EvaluationHtmlReportParams {
  projectName: string;
  record: EvaluationRecord;
  task: Task;
  evaluatorVersions: readonly EvaluatorVersion[];
  reviewEvents: readonly EvaluationReviewEvent[];
  generatedAt?: number;
}

export interface EvaluationHtmlReportSnapshot {
  schemaVersion: typeof EVALUATION_HTML_REPORT_SCHEMA;
  generatedAt: number;
  projectName: string;
  evaluation: EvaluationRecord;
  sourceTask: Task;
  evaluatorVersion: {
    status: ReportEvaluatorVersionStatus;
    requestedId?: string;
    sourceIntegrityFingerprint?: string;
    snapshot?: EvaluatorVersion;
  };
  humanReview: {
    events: EvaluationReviewEvent[];
    rejectedEventCount: number;
  };
  leaderboard: EvaluationLeaderboard;
  reportPolicy: {
    leaderboardBasis: "ai_original_scores";
    humanReviewBasis: "validated_append_only_overlay";
    sensitiveData: "redacted_before_export";
    remoteImages: "referenced_not_embedded";
    embeddedImages: "data_urls_only";
  };
}

export interface GeneratedEvaluationHtmlReport {
  html: string;
  fileName: string;
  fingerprint: string;
  snapshot: EvaluationHtmlReportSnapshot;
}

interface ReportEnvelope {
  fingerprint: string;
  payload: EvaluationHtmlReportSnapshot;
}

const SENSITIVE_FIELD =
  /(?:api[_-]?key|apikey|access[_-]?token|authorization|auth[_-]?token|token|secret|password|passwd|pwd)/i;

const STATUS_LABEL: Record<ResultItem["status"], string> = {
  pending: "等待中",
  running: "运行中",
  success: "成功",
  error: "失败",
  interrupted: "已中断",
};

const VERSION_STATUS_LABEL: Record<ReportEvaluatorVersionStatus, string> = {
  verified: "已绑定且源版本校验通过",
  unbound: "未绑定 Evaluator 版本",
  missing: "绑定版本已删除",
  corrupt: "绑定版本完整性校验失败",
};

/**
 * Builds a standalone report from saved project state only. The function never
 * calls a model, fetches an image, or mutates the source task/evaluation.
 */
export function generateEvaluationHtmlReport(
  params: EvaluationHtmlReportParams
): GeneratedEvaluationHtmlReport {
  validateParams(params);
  const generatedAt = params.generatedAt ?? Date.now();
  const evaluatorVersion = resolveEvaluatorVersion(
    params.record,
    params.evaluatorVersions
  );
  const validReviewEvents: EvaluationReviewEvent[] = [];
  let rejectedEventCount = 0;
  for (const event of params.reviewEvents) {
    if (event.evaluationId !== params.record.id) continue;
    if (isIntactReview(event)) validReviewEvents.push(event);
    else rejectedEventCount += 1;
  }
  validReviewEvents.sort(
    (left, right) =>
      left.createTime - right.createTime || left.id.localeCompare(right.id)
  );

  const targets = collectTargets(params.task);
  const rawSnapshot: EvaluationHtmlReportSnapshot = {
    schemaVersion: EVALUATION_HTML_REPORT_SCHEMA,
    generatedAt,
    projectName: params.projectName.trim(),
    evaluation: params.record,
    sourceTask: params.task,
    evaluatorVersion,
    humanReview: {
      events: validReviewEvents,
      rejectedEventCount,
    },
    leaderboard: buildEvaluationLeaderboard(
      params.record,
      undefined,
      targets
    ),
    reportPolicy: {
      leaderboardBasis: "ai_original_scores",
      humanReviewBasis: "validated_append_only_overlay",
      sensitiveData: "redacted_before_export",
      remoteImages: "referenced_not_embedded",
      embeddedImages: "data_urls_only",
    },
  };
  const snapshot = sanitizeClone(rawSnapshot);
  const fingerprint = fingerprintSnapshot(snapshot);
  return {
    snapshot,
    fingerprint,
    fileName: buildFileName(snapshot.projectName, generatedAt),
    html: renderReport({ fingerprint, payload: snapshot }),
  };
}

export function downloadEvaluationHtmlReport(
  params: EvaluationHtmlReportParams
): GeneratedEvaluationHtmlReport {
  const report = generateEvaluationHtmlReport(params);
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("当前环境不支持下载 HTML 报告");
  }
  const blob = new Blob([report.html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = report.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return report;
}

export function fingerprintEvaluationHtmlReportSnapshot(
  snapshot: EvaluationHtmlReportSnapshot
): string {
  return fingerprintSnapshot(snapshot);
}

function validateParams(params: EvaluationHtmlReportParams): void {
  if (!params.projectName.trim()) throw new Error("项目名称不能为空");
  if (!params.record.id) throw new Error("评价记录 id 不能为空");
  if (!params.task.id) throw new Error("来源批次 id 不能为空");
  if (params.record.sourceTaskId !== params.task.id) {
    throw new Error("评价记录与来源批次不匹配，已停止导出");
  }
  const generatedAt = params.generatedAt ?? Date.now();
  if (
    !Number.isSafeInteger(generatedAt) ||
    generatedAt < 0 ||
    Number.isNaN(new Date(generatedAt).getTime())
  ) {
    throw new Error("报告生成时间非法");
  }
}

function resolveEvaluatorVersion(
  record: EvaluationRecord,
  versions: readonly EvaluatorVersion[]
): EvaluationHtmlReportSnapshot["evaluatorVersion"] {
  if (!record.evaluatorVersionId) return { status: "unbound" };
  const version = versions.find((item) => item.id === record.evaluatorVersionId);
  if (!version) {
    return { status: "missing", requestedId: record.evaluatorVersionId };
  }
  if (!isIntactEvaluatorVersion(version)) {
    return { status: "corrupt", requestedId: record.evaluatorVersionId };
  }
  return {
    status: "verified",
    requestedId: record.evaluatorVersionId,
    sourceIntegrityFingerprint: version.integrityFingerprint,
    snapshot: version,
  };
}

function isIntactEvaluatorVersion(version: EvaluatorVersion): boolean {
  try {
    return isEvaluatorVersionIntact(version);
  } catch {
    return false;
  }
}

function isIntactReview(event: EvaluationReviewEvent): boolean {
  try {
    return isEvaluationReviewEventIntact(event);
  } catch {
    return false;
  }
}

function collectTargets(task: Task): { targetId: string; targetName: string }[] {
  const names = new Map<string, string>();
  for (const row of task.results) {
    for (const item of row.items) {
      if (!names.has(item.targetId)) {
        names.set(item.targetId, item.targetName.trim() || item.targetId);
      }
    }
  }
  for (const targetId of task.targetIds) {
    if (!names.has(targetId)) names.set(targetId, targetId);
  }
  return Array.from(names, ([targetId, targetName]) => ({
    targetId,
    targetName,
  }));
}

function sanitizeClone<T>(value: T): T {
  return sanitizeValue(value, new WeakSet<object>()) as T;
}

function sanitizeValue(
  value: unknown,
  ancestors: WeakSet<object>,
  fieldName = ""
): unknown {
  if (SENSITIVE_FIELD.test(fieldName)) return "[REDACTED]";
  if (typeof value === "string") {
    return value.startsWith("data:image/") ? value : redactSensitiveText(value);
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return typeof value === "number" && !Number.isFinite(value) ? null : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error("报告数据包含循环引用");
    ancestors.add(value);
    const result = value.map((item) => sanitizeValue(item, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (typeof value === "object" && value !== null) {
    if (ancestors.has(value)) throw new Error("报告数据包含循环引用");
    ancestors.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || typeof item === "function") continue;
      result[key] = sanitizeValue(item, ancestors, key);
    }
    ancestors.delete(value);
    return result;
  }
  return null;
}

function fingerprintSnapshot(snapshot: EvaluationHtmlReportSnapshot): string {
  const canonical = canonicalStringify(snapshot);
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash = Math.imul(hash ^ canonical.charCodeAt(index), 0x01000193);
  }
  return `report:v1:${(hash >>> 0).toString(16).padStart(8, "0")}:${canonical.length}`;
}

function canonicalStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const entries = Object.keys(source)
      .filter((key) => source[key] !== undefined)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalStringify(source[key])}`
      );
    return `{${entries.join(",")}}`;
  }
  return "null";
}

function renderReport(envelope: ReportEnvelope): string {
  const snapshot = envelope.payload;
  const envelopeJson = escapeJsonForScript(JSON.stringify(envelope));
  const prettySnapshot = escapeHtml(JSON.stringify(snapshot, null, 2));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>${escapeHtml(snapshot.projectName)} · AI 评价报告</title>
  <style>${REPORT_CSS}</style>
</head>
<body data-report-schema="${EVALUATION_HTML_REPORT_SCHEMA}" data-report-integrity="pending">
  <div class="paper-noise" aria-hidden="true"></div>
  <header class="hero">
    <div class="hero-kicker">LU EVAL PLATFORM · OFFLINE REPORT</div>
    <div class="hero-grid">
      <div>
        <p class="eyebrow">可复核评价快照</p>
        <h1>${escapeHtml(snapshot.projectName)}</h1>
        <p class="hero-subtitle">评价结果、执行配置、Evaluator 版本与人工复核在导出时冻结为同一份离线证据。</p>
      </div>
      <div class="hero-actions">
        <button id="print-report" type="button">打印 / 另存 PDF</button>
        <button id="download-snapshot" type="button" class="secondary">下载 JSON 快照</button>
      </div>
    </div>
    <div class="integrity-card">
      <span id="integrity-status" role="status">完整性校验：待校验</span>
      <code>${escapeHtml(envelope.fingerprint)}</code>
    </div>
  </header>

  <main>
    ${renderOverview(snapshot)}
    ${renderLeaderboard(snapshot.leaderboard)}
    ${renderRubric(snapshot)}
    ${renderEvaluatorVersion(snapshot)}
    ${renderCases(snapshot)}
    <section class="report-section raw-snapshot" aria-labelledby="raw-snapshot-title">
      <div class="section-heading">
        <p class="section-index">06</p>
        <div>
          <h2 id="raw-snapshot-title">完整机器可读快照</h2>
          <p>以下 JSON 与页面顶部指纹一一对应；内容在导出前执行常见凭证脱敏。</p>
        </div>
      </div>
      <details>
        <summary>展开脱敏后的原始 Task、评价、版本与复核事件</summary>
        <pre>${prettySnapshot}</pre>
      </details>
    </section>
  </main>

  <footer>
    <span>${escapeHtml(EVALUATION_HTML_REPORT_SCHEMA)}</span>
    <span>生成于 ${escapeHtml(formatDateTime(snapshot.generatedAt))}</span>
    <span>报告不会自动调用模型或启动评价</span>
  </footer>

  <script id="report-snapshot" type="application/json">${envelopeJson}</script>
  <script>${REPORT_SCRIPT}</script>
</body>
</html>`;
}

function renderOverview(snapshot: EvaluationHtmlReportSnapshot): string {
  const mode =
    snapshot.evaluation.evaluationMode === "reference"
      ? `标准答案 · ${snapshot.evaluation.expectedAnswerColumn ?? "自动识别"}`
      : "横向对比";
  return `<section class="report-section overview" aria-labelledby="overview-title">
    <div class="section-heading">
      <p class="section-index">01</p>
      <div><h2 id="overview-title">报告概览</h2><p>本页统计口径固定使用 AI 原始评分；人工复核以覆盖层单独展示。</p></div>
    </div>
    <div class="metric-grid">
      ${metricCard("评价 Case", String(snapshot.evaluation.count), "已归档评价条数")}
      ${metricCard("评价维度", String(snapshot.evaluation.dimensions.length), "Rubric 定义数量")}
      ${metricCard("正式上榜目标", String(snapshot.leaderboard.eligibleTargets), `共 ${snapshot.leaderboard.entries.length} 个目标`)}
      ${metricCard("有效人工复核", String(snapshot.humanReview.events.length), snapshot.humanReview.rejectedEventCount > 0 ? `${snapshot.humanReview.rejectedEventCount} 条损坏事件已隔离` : "无损坏事件")}
    </div>
    <dl class="metadata-grid">
      ${metadata("评价 ID", snapshot.evaluation.id)}
      ${metadata("来源批次", snapshot.sourceTask.id)}
      ${metadata("评价时间", formatDateTime(snapshot.evaluation.createTime))}
      ${metadata("报告时间", formatDateTime(snapshot.generatedAt))}
      ${metadata("评价模式", mode)}
      ${metadata("裁判模型 ID", snapshot.evaluation.evalModelId)}
      ${metadata("范围", snapshot.evaluation.scope === "selected" ? "选中 Case" : "全部 Case")}
      ${metadata("状态", snapshot.evaluation.status === "done" ? "已完成" : "异常")}
    </dl>
    <div class="policy-note"><strong>安全与离线边界</strong><span>常见 Key、Token 与密码字段已脱敏；远程图片不发起网络请求，仅保留引用说明；上传图片和 data URL 输出可离线展示。</span></div>
  </section>`;
}

function renderLeaderboard(leaderboard: EvaluationLeaderboard): string {
  const rows = leaderboard.entries
    .map(
      (entry) => `<tr>
        <td><span class="rank ${entry.rank === 1 ? "winner" : ""}">${entry.rank ?? "—"}</span></td>
        <td><strong>${escapeHtml(entry.targetName)}</strong><code>${escapeHtml(entry.targetId)}</code></td>
        <td>${entry.score === null ? "—" : entry.score.toFixed(2)}</td>
        <td>${entry.evaluatedCases}/${entry.totalCases}</td>
        <td>${formatPercent(entry.coverageRatio)}</td>
        <td>${entry.vetoedCases}</td>
        <td>${entry.dimensionAverages.map((item) => `<span class="score-chip">${escapeHtml(item.dimension)} ${item.score === null ? "—" : item.score.toFixed(2)}</span>`).join("")}</td>
      </tr>`
    )
    .join("");
  return `<section class="report-section" aria-labelledby="leaderboard-title">
    <div class="section-heading">
      <p class="section-index">02</p>
      <div><h2 id="leaderboard-title">AI 原始分排行榜</h2><p>缺失任一所选维度的目标不补零且不授予正式名次。</p></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>名次</th><th>模型 / 算法</th><th>综合分</th><th>有效 Case</th><th>覆盖率</th><th>否决</th><th>维度均分</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="empty">当前记录没有可排名的完整评分</td></tr>`}</tbody>
    </table></div>
  </section>`;
}

function renderRubric(snapshot: EvaluationHtmlReportSnapshot): string {
  const dimensions = snapshot.evaluation.dimensions
    .map(
      (dimension, index) => `<article class="rubric-card">
        <div class="rubric-title"><span>${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(dimension.name)}</h3><b>${dimension.weight ?? "—"}%</b></div>
        <p>${escapeHtml(dimension.desc ?? "未保存维度说明")}</p>
        <dl>
          <dt>一票否决</dt><dd>${dimension.vetoThreshold === undefined ? "未配置" : `低于 ${dimension.vetoThreshold} 分`}</dd>
          <dt>证据要求</dt><dd>${renderTextList(dimension.evidenceRequirements, "未保存")}</dd>
          <dt>判定步骤</dt><dd>${escapeHtml(dimension.judgeInstruction ?? "未保存")}</dd>
          <dt>评分锚点</dt><dd>${dimension.scoreLevels?.map((level) => `${level.score} 分：${escapeHtml(level.criteria)}`).join("<br>") ?? "旧记录未保存"}</dd>
        </dl>
      </article>`
    )
    .join("");
  return `<section class="report-section" aria-labelledby="rubric-title">
    <div class="section-heading">
      <p class="section-index">03</p>
      <div><h2 id="rubric-title">评价配置与 Rubric</h2><p>评价需求、维度定义、权重、阈值、证据和最终 Prompt 均来自历史快照。</p></div>
    </div>
    <div class="quote-block"><span>评测目标</span><p>${escapeHtml(snapshot.evaluation.userRequirement)}</p></div>
    <div class="rubric-grid">${dimensions || `<p class="empty">该旧记录没有维度快照</p>`}</div>
    <details class="prompt-details"><summary>查看最终 Judge Prompt</summary><pre>${escapeHtml(snapshot.evaluation.evalPrompt)}</pre></details>
  </section>`;
}

function renderEvaluatorVersion(snapshot: EvaluationHtmlReportSnapshot): string {
  const evaluator = snapshot.evaluatorVersion;
  const version = evaluator.snapshot;
  const versionBody = version
    ? `<div class="version-banner valid"><span>源版本导出时完整性校验通过</span><code>${escapeHtml(evaluator.sourceIntegrityFingerprint ?? "")}</code></div>
       <dl class="metadata-grid compact">
         ${metadata("名称", `${version.name} v${version.version}`)}
         ${metadata("Evaluator ID", version.evaluatorId)}
         ${metadata("创建人", version.createdBy)}
         ${metadata("创建时间", formatDateTime(version.createTime))}
         ${metadata("变更说明", version.changeNote ?? "未填写")}
         ${metadata("策略指纹", version.policyFingerprint)}
         ${metadata("定义指纹", version.definitionFingerprint)}
         ${metadata("适用批次", version.applicableTaskId)}
       </dl>
       <details><summary>展开完整 Evaluator 版本 JSON</summary><pre>${escapeHtml(JSON.stringify(version, null, 2))}</pre></details>`
    : `<div class="version-banner warning"><span>${escapeHtml(VERSION_STATUS_LABEL[evaluator.status])}</span><code>${escapeHtml(evaluator.requestedId ?? "无版本 ID")}</code></div>
       <p class="boundary-copy">报告不会猜测或补造缺失版本；评价记录本身仍完整保留。</p>`;
  return `<section class="report-section" aria-labelledby="version-title">
    <div class="section-heading">
      <p class="section-index">04</p>
      <div><h2 id="version-title">Evaluator 版本快照</h2><p>源版本先通过平台完整性校验，再进入脱敏报告；脱敏后的整体由报告指纹重新保护。</p></div>
    </div>
    ${versionBody}
  </section>`;
}

function renderCases(snapshot: EvaluationHtmlReportSnapshot): string {
  const inputById = new Map(
    snapshot.sourceTask.inputs.map((input) => [input.id, input])
  );
  const resultByInputId = new Map(
    snapshot.sourceTask.results.map((row) => [row.inputId, row])
  );
  const latestReviewByKey = new Map<string, EvaluationReviewEvent>();
  for (const event of snapshot.humanReview.events) {
    latestReviewByKey.set(event.reviewKey, event);
  }
  const targetNameById = new Map<string, string>();
  for (const row of snapshot.sourceTask.results) {
    for (const item of row.items) {
      targetNameById.set(item.targetId, item.targetName || item.targetId);
    }
  }
  const cases = snapshot.evaluation.results
    .map((evaluation, caseIndex) => {
      const input = inputById.get(evaluation.inputId);
      const row = resultByInputId.get(evaluation.inputId);
      const targets = evaluation.scores
        .map((score) => {
          const output = row?.items.find((item) => item.targetId === score.targetId);
          const review = latestReviewByKey.get(
            `${snapshot.evaluation.id}:${evaluation.inputId}:${score.targetId}`
          );
          return renderCaseTarget(
            score,
            output,
            review,
            targetNameById
          );
        })
        .join("");
      return `<article class="case-card">
        <header><div><span>CASE ${String(caseIndex + 1).padStart(3, "0")}</span><code>${escapeHtml(evaluation.inputId)}</code></div><b>${evaluation.scores.length} 个目标</b></header>
        <div class="case-input">
          <h3>输入</h3>
          <p>${escapeHtml(input?.prompt || "（无 prompt 或来源输入已删除）")}</p>
          ${renderInputImages(input?.images ?? [])}
          ${input?.extraFields && Object.keys(input.extraFields).length > 0 ? `<details><summary>额外字段</summary><pre>${escapeHtml(JSON.stringify(input.extraFields, null, 2))}</pre></details>` : ""}
        </div>
        <div class="target-stack">${targets || `<p class="empty">该 Case 没有目标评分</p>`}</div>
        <div class="case-conclusion"><div><span>总体结论</span><p>${escapeHtml(evaluation.summary || "未保存")}</p></div><div><span>推荐项</span><p>${escapeHtml(evaluation.recommendation || "未保存")}</p></div></div>
      </article>`;
    })
    .join("");
  return `<section class="report-section" aria-labelledby="cases-title">
    <div class="section-heading">
      <p class="section-index">05</p>
      <div><h2 id="cases-title">原始结果与逐 Case 证据</h2><p>每个目标同时保留输出、AI 原分、Judge 理由与证据；有效人工复核另行标注。</p></div>
    </div>
    <div class="case-list">${cases || `<p class="empty">该评价记录没有 Case 结果</p>`}</div>
  </section>`;
}

function renderCaseTarget(
  score: EvaluationRecord["results"][number]["scores"][number],
  output: ResultItem | undefined,
  review: EvaluationReviewEvent | undefined,
  targetNameById: ReadonlyMap<string, string>
): string {
  const humanScoreByDimension = new Map(
    (review?.humanDimensionScores ?? []).map((item) => [
      item.dimension,
      item.score,
    ])
  );
  const dimensionCards = score.dimensionScores
    .map((dimension) => {
      const humanScore = humanScoreByDimension.get(dimension.dimension);
      return `<article class="dimension-card">
        <div><h4>${escapeHtml(dimension.dimension)}</h4><strong>${humanScore === undefined ? dimension.score.toFixed(1) : humanScore.toFixed(1)}</strong></div>
        ${humanScore === undefined ? "" : `<p class="ai-origin">人工有效分 · AI 原分 ${dimension.score.toFixed(1)}</p>`}
        <p>${escapeHtml(dimension.comment || "未保存 Judge 理由")}</p>
        ${renderEvidence(dimension.evidence, targetNameById)}
      </article>`;
    })
    .join("");
  const outputBlock = output
    ? `<div class="output-block"><div class="output-meta"><span>${escapeHtml(STATUS_LABEL[output.status])}</span><span>${output.latencyMs === undefined ? "未记录耗时" : `${output.latencyMs} ms`}</span></div><p>${escapeHtml(output.outputText || output.error || "（无文字输出）")}</p>${renderOutputImages(output.outputImages ?? [])}</div>`
    : `<div class="output-block missing">来源批次中没有该目标的原始输出</div>`;
  const reviewBlock = review
    ? `<div class="review-block"><div><strong>人工复核覆盖</strong>${review.isBadCase ? `<span class="bad-case">Bad Case</span>` : ""}</div><p>${escapeHtml(review.note)}</p><small>${escapeHtml(review.actor)} · ${escapeHtml(formatDateTime(review.createTime))} · 加权分 ${review.humanWeightedScore.toFixed(2)} · ${review.humanVetoed ? "已否决" : "未否决"}</small></div>`
    : "";
  return `<section class="target-card">
    <header><div><h3>${escapeHtml(score.targetName)}</h3><code>${escapeHtml(score.targetId)}</code></div><div class="weighted-score"><span>${review ? "人工有效" : "AI 加权"}</span><b>${review ? review.humanWeightedScore.toFixed(2) : score.weightedScore?.toFixed(2) ?? "—"}</b><small>${review ? `AI 原分 ${score.weightedScore?.toFixed(2) ?? "—"}` : score.vetoed ? "已否决" : score.vetoed === false ? "未否决" : "无策略结果"}</small></div></header>
    ${outputBlock}
    <div class="dimension-grid">${dimensionCards || `<p class="empty">没有维度分</p>`}</div>
    ${reviewBlock}
    ${score.overallComment ? `<p class="overall-comment"><strong>总体点评</strong>${escapeHtml(score.overallComment)}</p>` : ""}
  </section>`;
}

function renderEvidence(
  evidence: EvaluationEvidence[] | undefined,
  targetNameById: ReadonlyMap<string, string>
): string {
  if (!evidence || evidence.length === 0) {
    return `<p class="evidence-empty">未保存结构化证据</p>`;
  }
  return `<ol class="evidence-list">${evidence
    .map((item) => {
      if (item.kind === "text_quote") {
        return `<li><span>${escapeHtml(evidenceSourceLabel(item.source, item.targetId, targetNameById))} · [${item.start}, ${item.end})</span><q>${escapeHtml(item.quote)}</q></li>`;
      }
      return `<li><span>${escapeHtml(evidenceSourceLabel(item.source, item.targetId, targetNameById))} · 图片 #${item.imageIndex}</span><q>${escapeHtml(item.observation)}</q></li>`;
    })
    .join("")}</ol>`;
}

function evidenceSourceLabel(
  source: EvaluationTextEvidenceSource | EvaluationImageEvidenceSource,
  targetId: string | undefined,
  targetNameById: ReadonlyMap<string, string>
): string {
  if (source === "input_prompt") return "输入 prompt";
  if (source === "expected_answer") return "标准答案";
  if (source === "input_image") return "输入图片";
  const targetName = targetId
    ? targetNameById.get(targetId) ?? targetId
    : "未知目标";
  return source === "target_image"
    ? `${targetName} 输出图片`
    : `${targetName} 输出`;
}

function renderInputImages(images: Task["inputs"][number]["images"]): string {
  if (images.length === 0) return "";
  return `<div class="image-grid">${images
    .map((image, index) => renderImage(image.value, image.name || `输入图 ${index + 1}`))
    .join("")}</div>`;
}

function renderOutputImages(images: string[]): string {
  if (images.length === 0) return "";
  return `<div class="image-grid">${images
    .map((source, index) => renderImage(source, `输出图 ${index + 1}`))
    .join("")}</div>`;
}

function renderImage(source: string, label: string): string {
  if (source.startsWith("data:image/")) {
    return `<figure><img src="${escapeAttribute(source)}" alt="${escapeAttribute(label)}"><figcaption>${escapeHtml(label)} · 已内嵌</figcaption></figure>`;
  }
  return `<figure class="remote-image"><div aria-label="${escapeAttribute(label)}未离线嵌入">REMOTE</div><figcaption>${escapeHtml(label)} · 远程图片未嵌入<br><code>${escapeHtml(summarizeRemoteSource(source))}</code></figcaption></figure>`;
}

function summarizeRemoteSource(source: string): string {
  if (source.length <= 180) return source;
  return `${source.slice(0, 120)}…${source.slice(-40)}`;
}

function metricCard(label: string, value: string, hint: string): string {
  return `<article><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(hint)}</small></article>`;
}

function metadata(label: string, value: string): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderTextList(values: string[] | undefined, fallback: string): string {
  return values && values.length > 0
    ? values.map((value) => escapeHtml(value)).join("；")
    : fallback;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10_000) / 100}%`;
}

function formatDateTime(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间无效";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function buildFileName(projectName: string, generatedAt: number): string {
  const timestamp = new Date(generatedAt)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  const safeProjectName = (projectName.trim() || "未命名项目").replace(
    /[\\/:*?"<>|]/g,
    "_"
  );
  return `${safeProjectName}_AI评价报告_${timestamp}.html`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeJsonForScript(value: string): string {
  return value
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const REPORT_SCRIPT = String.raw`
(function () {
  var status = document.getElementById("integrity-status");
  var source = document.getElementById("report-snapshot");
  function canonical(value) {
    if (value === null) return "null";
    if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (typeof value === "object") {
      return "{" + Object.keys(value).sort().filter(function (key) { return value[key] !== undefined; }).map(function (key) {
        return JSON.stringify(key) + ":" + canonical(value[key]);
      }).join(",") + "}";
    }
    return "null";
  }
  function fingerprint(value) {
    var text = canonical(value);
    var hash = 0x811c9dc5;
    for (var index = 0; index < text.length; index += 1) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
    }
    return "report:v1:" + (hash >>> 0).toString(16).padStart(8, "0") + ":" + text.length;
  }
  try {
    var envelope = JSON.parse(source.textContent || "");
    var valid = fingerprint(envelope.payload) === envelope.fingerprint;
    status.textContent = valid ? "完整性校验：通过" : "完整性校验：失败";
    status.className = valid ? "integrity-valid" : "integrity-invalid";
    document.body.dataset.reportIntegrity = valid ? "valid" : "invalid";
    document.getElementById("print-report").addEventListener("click", function () { window.print(); });
    document.getElementById("download-snapshot").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "evaluation-report-snapshot.json";
      anchor.click();
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    status.textContent = "完整性校验：失败";
    status.className = "integrity-invalid";
    document.body.dataset.reportIntegrity = "invalid";
  }
})();`;

const REPORT_CSS = String.raw`
:root{--ink:#1e293b;--muted:#64748b;--paper:#f5f1e8;--card:#fffdf8;--line:#d8d1c2;--accent:#c2410c;--accent-soft:#ffedd5;--teal:#0f766e;--teal-soft:#ccfbf1;--red:#b91c1c;--shadow:0 18px 50px rgba(55,45,30,.09)}
*{box-sizing:border-box}html{background:var(--paper);color:var(--ink);font-family:"Avenir Next","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6}body{margin:0;min-width:0}.paper-noise{position:fixed;inset:0;pointer-events:none;opacity:.2;background-image:radial-gradient(#9a8f7a 0.55px,transparent .55px);background-size:7px 7px}.hero,main,footer{position:relative;z-index:1}.hero{padding:64px max(24px,calc((100vw - 1180px)/2));background:linear-gradient(135deg,#172554 0%,#0f3d3a 58%,#115e59 100%);color:#fff;overflow:hidden}.hero:after{content:"";position:absolute;width:420px;height:420px;right:-120px;top:-190px;border:70px solid rgba(255,255,255,.08);border-radius:50%}.hero-kicker{font-size:11px;font-weight:800;letter-spacing:.22em;color:#fed7aa}.hero-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:36px;align-items:end}.eyebrow{margin:28px 0 4px;color:#99f6e4;font-size:13px;font-weight:700}.hero h1{margin:0;font-family:"Iowan Old Style","Songti SC",serif;font-size:clamp(38px,7vw,76px);font-weight:700;line-height:1.05;letter-spacing:-.04em}.hero-subtitle{max-width:760px;margin:22px 0 0;color:#d7f7f1;font-size:16px}.hero-actions{display:flex;flex-direction:column;gap:10px}.hero button{border:1px solid #fed7aa;border-radius:999px;background:#fed7aa;color:#7c2d12;padding:10px 18px;font-weight:800;cursor:pointer}.hero button.secondary{background:transparent;color:#fff;border-color:rgba(255,255,255,.42)}.integrity-card{margin-top:38px;display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;border-top:1px solid rgba(255,255,255,.2);padding-top:20px}.integrity-card span{border-radius:999px;background:rgba(255,255,255,.12);padding:5px 11px;font-size:12px;font-weight:800}.integrity-card .integrity-valid{background:#ccfbf1;color:#115e59}.integrity-card .integrity-invalid{background:#fee2e2;color:#991b1b}.integrity-card code{color:#cbd5e1;font-size:11px;word-break:break-all}main{width:min(1180px,calc(100% - 32px));margin:38px auto 80px}.report-section{margin-bottom:28px;border:1px solid var(--line);border-radius:24px;background:rgba(255,253,248,.96);padding:30px;box-shadow:var(--shadow)}.section-heading{display:flex;gap:18px;align-items:flex-start;margin-bottom:24px}.section-index{margin:0;border-top:3px solid var(--accent);padding-top:6px;color:var(--accent);font-size:12px;font-weight:900;letter-spacing:.14em}.section-heading h2{margin:0;font-family:"Iowan Old Style","Songti SC",serif;font-size:29px;line-height:1.2}.section-heading p:not(.section-index){margin:5px 0 0;color:var(--muted);font-size:13px}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric-grid article{display:flex;min-height:138px;flex-direction:column;border-radius:18px;background:linear-gradient(145deg,#fff7ed,#f8fafc);padding:18px}.metric-grid span{color:var(--muted);font-size:12px}.metric-grid b{margin-top:auto;font-family:"Iowan Old Style",serif;font-size:38px;line-height:1;color:#0f3d3a}.metric-grid small{margin-top:8px;color:#78716c}.metadata-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:22px 0 0;border:1px solid var(--line);border-radius:16px;overflow:hidden}.metadata-grid>div{min-width:0;padding:13px 15px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.metadata-grid dt{color:var(--muted);font-size:11px}.metadata-grid dd{margin:3px 0 0;font-size:13px;font-weight:700;word-break:break-all}.metadata-grid.compact{grid-template-columns:repeat(3,minmax(0,1fr))}.policy-note{display:flex;gap:18px;margin-top:18px;border-left:4px solid var(--accent);background:var(--accent-soft);padding:14px 16px;color:#7c2d12;font-size:12px}.policy-note strong{flex:none}.table-wrap{max-width:100%;overflow:auto;border:1px solid var(--line);border-radius:16px}table{width:100%;min-width:840px;border-collapse:collapse;font-size:12px}th{background:#f1ede4;color:#57534e;text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase}th,td{padding:12px 14px;border-bottom:1px solid #e7e1d6;vertical-align:top}tbody tr:last-child td{border-bottom:0}td code{display:block;color:#94a3b8;font-size:9px}.rank{display:inline-grid;min-width:28px;height:28px;place-items:center;border-radius:50%;background:#e2e8f0;font-weight:900}.rank.winner{background:#fdba74;color:#7c2d12}.score-chip{display:inline-block;margin:0 4px 4px 0;border-radius:999px;background:#ecfdf5;padding:2px 7px;color:#047857;white-space:nowrap}.empty{padding:30px;text-align:center;color:#94a3b8}.quote-block{border-radius:16px;background:#172554;padding:18px 20px;color:#fff}.quote-block span{color:#fdba74;font-size:10px;font-weight:900;letter-spacing:.12em}.quote-block p{margin:6px 0 0;white-space:pre-wrap}.rubric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.rubric-card{border:1px solid var(--line);border-radius:16px;padding:17px}.rubric-title{display:flex;gap:10px;align-items:center}.rubric-title span{color:var(--accent);font-size:10px;font-weight:900}.rubric-title h3{margin:0;font-size:16px}.rubric-title b{margin-left:auto;color:var(--teal)}.rubric-card>p{color:var(--muted);font-size:12px}.rubric-card dl{display:grid;grid-template-columns:80px 1fr;gap:7px 12px;margin:15px 0 0;font-size:11px}.rubric-card dt{color:#94a3b8}.rubric-card dd{margin:0}.prompt-details,.raw-snapshot details,.target-card details{margin-top:16px;border-radius:12px;background:#f8fafc;padding:12px 14px}.prompt-details summary,details summary{cursor:pointer;font-size:12px;font-weight:800;color:#334155}pre{max-width:100%;overflow:auto;white-space:pre-wrap;word-break:break-word;font:11px/1.65 "SFMono-Regular",Consolas,monospace}.version-banner{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;border-radius:14px;padding:14px 16px;font-size:12px;font-weight:800}.version-banner.valid{background:var(--teal-soft);color:#115e59}.version-banner.warning{background:#fef3c7;color:#92400e}.version-banner code{word-break:break-all}.boundary-copy{color:var(--muted);font-size:12px}.case-list{display:flex;flex-direction:column;gap:22px}.case-card{overflow:hidden;border:1px solid var(--line);border-radius:20px;background:#fff}.case-card>header{display:flex;justify-content:space-between;align-items:center;background:#f1ede4;padding:12px 17px}.case-card>header div{display:flex;gap:10px;align-items:center}.case-card>header span{font-size:10px;font-weight:900;letter-spacing:.12em;color:var(--accent)}.case-card>header code{font-size:10px;color:#78716c}.case-card>header b{font-size:11px}.case-input{padding:18px;border-bottom:1px solid var(--line)}.case-input h3{margin:0;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.case-input>p{margin:6px 0 0;white-space:pre-wrap}.target-stack{display:flex;flex-direction:column}.target-card{padding:20px;border-bottom:1px solid var(--line)}.target-card:last-child{border-bottom:0}.target-card>header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.target-card h3{margin:0;font-size:18px}.target-card code{color:#94a3b8;font-size:10px}.weighted-score{display:grid;grid-template-columns:auto auto;gap:0 10px;text-align:right}.weighted-score span{grid-column:1;font-size:9px;color:var(--muted)}.weighted-score b{grid-column:2;grid-row:1/3;font-family:"Iowan Old Style",serif;font-size:31px;line-height:1;color:var(--teal)}.weighted-score small{grid-column:1;color:#94a3b8;font-size:9px}.output-block{margin-top:14px;border-radius:14px;background:#f8fafc;padding:14px}.output-block.missing{color:#94a3b8;font-size:12px}.output-block>p{margin:8px 0 0;white-space:pre-wrap}.output-meta{display:flex;gap:8px;color:var(--muted);font-size:10px}.dimension-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.dimension-card{border:1px solid #e2e8f0;border-radius:14px;padding:14px}.dimension-card>div{display:flex;justify-content:space-between;gap:12px}.dimension-card h4{margin:0;font-size:13px}.dimension-card strong{color:#1d4ed8}.dimension-card>p{margin:8px 0;color:var(--muted);font-size:11px}.dimension-card .ai-origin{color:var(--teal);font-weight:700}.evidence-list{margin:12px 0 0;padding:0;list-style:none}.evidence-list li{margin-top:7px;border-left:3px solid #93c5fd;padding:5px 8px;background:#eff6ff}.evidence-list span{display:block;color:#1e40af;font-size:9px;font-weight:800}.evidence-list q{display:block;margin-top:3px;color:#334155;font-size:10px;quotes:"“" "”"}.evidence-empty{color:#94a3b8!important;font-style:italic}.review-block{margin-top:14px;border-radius:14px;background:var(--teal-soft);padding:13px 15px;color:#115e59}.review-block>div{display:flex;align-items:center;gap:8px}.review-block p{margin:5px 0;font-size:11px}.review-block small{font-size:9px}.bad-case{border-radius:999px;background:#fde68a;padding:2px 7px;color:#92400e;font-size:9px;font-weight:900}.overall-comment{display:flex;gap:10px;margin:12px 0 0;color:var(--muted);font-size:11px}.overall-comment strong{color:var(--ink)}.case-conclusion{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border-top:1px solid var(--line)}.case-conclusion>div{background:#fffcf5;padding:15px 18px}.case-conclusion span{color:var(--accent);font-size:9px;font-weight:900;letter-spacing:.08em}.case-conclusion p{margin:4px 0 0;font-size:12px}.image-grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.image-grid figure{width:150px;margin:0}.image-grid img,.remote-image>div{display:grid;width:150px;height:110px;place-items:center;border:1px solid var(--line);border-radius:10px;object-fit:cover;background:#e2e8f0;color:#64748b;font-size:10px;font-weight:900;letter-spacing:.14em}.image-grid figcaption{margin-top:5px;color:var(--muted);font-size:9px;word-break:break-all}.image-grid figcaption code{font-size:8px}.raw-snapshot pre{max-height:540px}footer{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 30px;border-top:1px solid var(--line);padding:24px;color:#78716c;font-size:10px}
:root{--accent:#9a3412}.metric-grid small,.case-card>header code,footer{color:#57534e}td code,.empty,.rubric-card dt,.target-card code,.weighted-score small,.output-block.missing,.evidence-empty{color:#64748b!important}.image-grid img,.remote-image>div{color:#475569}
@media(max-width:780px){.hero{padding:42px 20px}.hero-grid{grid-template-columns:1fr}.hero-actions{align-items:flex-start}.report-section{padding:20px;border-radius:18px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.metadata-grid,.metadata-grid.compact{grid-template-columns:repeat(2,minmax(0,1fr))}.rubric-grid,.dimension-grid,.case-conclusion{grid-template-columns:1fr}.policy-note{flex-direction:column}.target-card>header{flex-direction:column}.weighted-score{text-align:left}.section-heading h2{font-size:24px}}
@media(max-width:440px){main{width:min(100% - 20px,1180px)}.metric-grid,.metadata-grid,.metadata-grid.compact{grid-template-columns:1fr}.hero h1{font-size:40px}.report-section{padding:16px}.section-heading{gap:12px}.case-card>header{align-items:flex-start;flex-direction:column}.image-grid figure,.image-grid img,.remote-image>div{width:100%}.image-grid figure{max-width:100%}}
@media print{.paper-noise,.hero-actions{display:none}.hero{padding:32px;background:#fff!important;color:var(--ink);border-bottom:2px solid var(--ink)}.hero-subtitle,.hero-kicker,.eyebrow{color:var(--ink)}main{width:100%;margin:18px 0}.report-section{break-inside:avoid;box-shadow:none;border-radius:0}.case-card,.target-card,.rubric-card{break-inside:avoid}details>summary{display:none}details>pre{display:block!important}footer{border-top:1px solid #000}}
`;
