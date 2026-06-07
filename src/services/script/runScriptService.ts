import { spawn, type ChildProcess } from "node:child_process";
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import type { RunScriptResult, ScriptLang } from "@/types";
import { RUNTIME_CONFIG } from "@/config/runtime";

/**
 * 脚本子进程执行服务（服务端，v4.2 决策 2/3/5/6/7）。
 *
 *  - 参数打包成 params JSON 经 stdin 注入（禁字符串替换进 code）。
 *  - 结果按 ===RESULT_JSON_START==={...}===RESULT_JSON_END=== 标记提取，非空判成功。
 *  - 超时杀进程（Windows 杀进程树）；失败返回 stderr 全文 + exitCode + envInfo。
 *  - 图片产物转 base64 data URL 收进结果体系；每次执行独立子目录。
 */

const RESULT_START = "===RESULT_JSON_START===";
const RESULT_END = "===RESULT_JSON_END===";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);

export interface RunScriptInput {
  lang: ScriptLang;
  code: string;
  /** 打包成 params JSON 经 stdin 传入脚本（含 prompt 与其余入参）。 */
  paramValues: Record<string, unknown>;
  /** 该目标声明的 key 环境变量名（仅注入这一个，决策7）。 */
  apiKeyEnvName?: string;
  /** key 真值（由调用方从 .env.local 读出后传入）。 */
  apiKeyValue?: string;
}

const isWindows = process.platform === "win32";

/** 探测脚本运行环境（python / node 是否可用及版本），用于失败诊断。 */
function probeEnv(lang: ScriptLang): string {
  const command = lang === "python" ? "python --version" : "node --version";
  const fallback = lang === "python" ? "python3 --version" : "";
  try {
    const out = execSync(command, { stdio: "pipe" }).toString().trim();
    return `检测到 ${out}`;
  } catch {
    if (fallback) {
      try {
        const out = execSync(fallback, { stdio: "pipe" }).toString().trim();
        return `未检测到 python，但检测到 ${out}（请确认 PATH 中可用 python 命令）`;
      } catch {
        return `未检测到 ${lang === "python" ? "python / python3" : "node"} 命令，请先安装并加入 PATH`;
      }
    }
    return `未检测到 ${lang} 运行环境，请先安装并加入 PATH`;
  }
}

/** 解析 lang 对应的解释器命令。python 优先 python，回退 python3。 */
function resolveInterpreter(lang: ScriptLang): string {
  if (lang === "node") {
    return "node";
  }
  try {
    execSync("python --version", { stdio: "pipe" });
    return "python";
  } catch {
    return "python3";
  }
}

/** 杀子进程（Windows 用 taskkill /T 杀进程树，决策7）。 */
function killProcessTree(child: ChildProcess): void {
  if (child.pid === undefined) {
    return;
  }
  if (isWindows) {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } catch {
      child.kill("SIGKILL");
    }
    return;
  }
  try {
    // 负 pid 杀整个进程组（spawn 时已 detached）。
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

/** 从 stdout 中按标记提取结果 JSON 文本；找不到返回 null。 */
function extractResultJson(stdout: string): string | null {
  const startIdx = stdout.indexOf(RESULT_START);
  const endIdx = stdout.indexOf(RESULT_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }
  return stdout.slice(startIdx + RESULT_START.length, endIdx).trim();
}

/** 把图片路径/URL 归一化为可展示形态：本地文件转 base64 data URL；http(s) / data 原样保留。 */
function normalizeImage(raw: string, outputDir: string): string | null {
  if (/^https?:\/\//.test(raw) || raw.startsWith("data:")) {
    return raw;
  }
  const filePath = existsSync(raw) ? raw : join(outputDir, raw);
  if (!existsSync(filePath)) {
    return null;
  }
  const ext = extname(filePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    return null;
  }
  const mime = ext === ".jpg" ? "image/jpeg" : `image/${ext.slice(1)}`;
  const base64 = readFileSync(filePath).toString("base64");
  return `data:${mime};base64,${base64}`;
}

/** 收集 outputDir 下新产生的图片（脚本未在 JSON 里显式给出 images 时兜底扫描）。 */
function scanOutputDirImages(outputDir: string): string[] {
  if (!existsSync(outputDir)) {
    return [];
  }
  const collected: string[] = [];
  for (const name of readdirSync(outputDir)) {
    if (IMAGE_EXTENSIONS.has(extname(name).toLowerCase())) {
      const dataUrl = normalizeImage(join(outputDir, name), outputDir);
      if (dataUrl) {
        collected.push(dataUrl);
      }
    }
  }
  return collected;
}

export async function runScript(input: RunScriptInput): Promise<RunScriptResult> {
  const { lang, code, paramValues, apiKeyEnvName, apiKeyValue } = input;
  const startTime = Date.now();

  // 每次执行独立子目录，避免并发产物互相覆盖（决策6）。
  const outputDir = mkdtempSync(join(tmpdir(), "evalscript-"));
  const scriptFile = join(outputDir, lang === "python" ? "script.py" : "script.js");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(scriptFile, code, "utf8");

  // params JSON 注入 outputDir，脚本可据此落地图片。
  const params = { ...paramValues, __output_dir__: outputDir };
  const stdinPayload = JSON.stringify(params);

  const childEnv: NodeJS.ProcessEnv = { ...process.env, SCRIPT_OUTPUT_DIR: outputDir };
  if (apiKeyEnvName && apiKeyValue) {
    childEnv[apiKeyEnvName] = apiKeyValue;
  }

  const interpreter = resolveInterpreter(lang);

  return new Promise<RunScriptResult>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(interpreter, [scriptFile], {
        env: childEnv,
        detached: !isWindows,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      resolve({
        ok: false,
        error: "无法启动脚本子进程",
        stderr: "",
        exitCode: null,
        envInfo: probeEnv(lang),
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, RUNTIME_CONFIG.scriptTimeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: `脚本启动失败：${err.message}`,
        stderr,
        exitCode: null,
        envInfo: probeEnv(lang),
        latencyMs: Date.now() - startTime,
      });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;

      if (timedOut) {
        resolve({
          ok: false,
          error: `脚本执行超时（超过 ${RUNTIME_CONFIG.scriptTimeoutMs / 1000}s），已终止进程`,
          stderr,
          exitCode,
          envInfo: probeEnv(lang),
          latencyMs,
        });
        return;
      }

      const resultJson = extractResultJson(stdout);
      if (resultJson === null) {
        resolve({
          ok: false,
          error:
            exitCode === 0
              ? "脚本未输出 RESULT_JSON 标记结果，无法判定成功（请检查脚本是否按约定输出）"
              : `脚本异常退出（exitCode=${exitCode}）`,
          stderr,
          exitCode,
          envInfo: probeEnv(lang),
          latencyMs,
        });
        return;
      }

      let parsed: { text?: unknown; images?: unknown };
      try {
        parsed = JSON.parse(resultJson) as { text?: unknown; images?: unknown };
      } catch {
        resolve({
          ok: false,
          error: "RESULT_JSON 标记内的内容不是合法 JSON",
          stderr,
          exitCode,
          envInfo: probeEnv(lang),
          latencyMs,
        });
        return;
      }

      const text = typeof parsed.text === "string" ? parsed.text : "";
      const declaredImages = Array.isArray(parsed.images)
        ? parsed.images.filter((i): i is string => typeof i === "string")
        : [];

      const normalizedImages = declaredImages
        .map((img) => normalizeImage(img, outputDir))
        .filter((img): img is string => img !== null);

      // 脚本声明了图片但都没取到，或未声明图片时，兜底扫描 outputDir。
      const images =
        normalizedImages.length > 0 ? normalizedImages : scanOutputDirImages(outputDir);

      if (!text && images.length === 0) {
        resolve({
          ok: false,
          error: "脚本输出结果为空（text 与 images 均为空），判为失败",
          stderr,
          exitCode,
          envInfo: probeEnv(lang),
          latencyMs,
        });
        return;
      }

      resolve({
        ok: true,
        text,
        images,
        outputDir,
        rawOutput: stdout,
        latencyMs,
      });
    });

    child.stdin?.write(stdinPayload);
    child.stdin?.end();
  });
}
