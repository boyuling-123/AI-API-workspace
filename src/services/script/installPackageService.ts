import { execFile } from "node:child_process";
import { execSync } from "node:child_process";

/**
 * pip 安装缺失包（v4.4 Agent 工具 install_package 的后端实现）。
 * 当 run_script 报 ModuleNotFoundError 时由 Agent 调用。
 */

export interface InstallPackageResult {
  ok: boolean;
  /** pip 的合并输出（stdout + stderr），供 Agent 判断与展示。 */
  output: string;
}

const isWindows = process.platform === "win32";

/** 解析可用的 python 解释器命令（python 优先，回退 python3）。 */
function resolvePython(): string {
  try {
    execSync("python --version", { stdio: "pipe" });
    return "python";
  } catch {
    return "python3";
  }
}

/** 安装上限：超时 120s，防止卡死。 */
const INSTALL_TIMEOUT_MS = 120_000;

export async function installPackages(
  packages: string[]
): Promise<InstallPackageResult> {
  const cleaned = packages
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && /^[A-Za-z0-9._-]+(\[[A-Za-z0-9,_-]+\])?(==[\w.]+)?$/.test(name));

  if (cleaned.length === 0) {
    return { ok: false, output: "未提供合法的 pip 包名" };
  }

  const python = resolvePython();
  const args = ["-m", "pip", "install", ...cleaned];

  return new Promise<InstallPackageResult>((resolve) => {
    execFile(
      python,
      args,
      { timeout: INSTALL_TIMEOUT_MS, windowsHide: isWindows },
      (error, stdout, stderr) => {
        const output = `${stdout ?? ""}${stderr ?? ""}`.trim();
        if (error) {
          resolve({
            ok: false,
            output:
              output ||
              `pip 安装失败：${error.message}（请确认本机已安装 Python 与 pip 并加入 PATH）`,
          });
          return;
        }
        resolve({ ok: true, output: output || `已安装：${cleaned.join(", ")}` });
      }
    );
  });
}
