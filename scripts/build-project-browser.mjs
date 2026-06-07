// 生成「项目浏览器 HTML」：左侧文件树 + 右侧文件内容 + 右上角一键下载 zip。
// 把项目所有源文件（排除 node_modules/.next/.git 等）内嵌进单个自包含 HTML。
// 文本文件以字符串内嵌；二进制文件（woff/ico/xlsx 等）以 base64 内嵌，保证解压后可运行。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "outputs",
]);

// 这些文件不打进 zip 也不展示（敏感 / 体积大且无意义 / 临时产物）
const EXCLUDE_FILES = new Set([
  ".env.local",
  ".DS_Store",
  "tsconfig.tsbuildinfo",
  "dev.log",
  "package-lock.json",
  "build-project-browser.mjs",
]);

// 二进制扩展名：以 base64 内嵌，下载时还原为二进制
const BINARY_EXTS = new Set([
  ".woff", ".woff2", ".ttf", ".otf",
  ".ico", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".xlsx", ".xls", ".zip", ".pdf",
]);

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 单个文本文件上限 2MB，超出则截断展示但仍打包

function isExcludedFile(name) {
  return EXCLUDE_FILES.has(name);
}

function walk(dir, relBase = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      files = files.concat(walk(path.join(dir, entry.name), path.join(relBase, entry.name)));
      continue;
    }
    if (isExcludedFile(entry.name)) continue;
    files.push(path.join(relBase, entry.name));
  }
  return files;
}

function readFileEntry(relPath) {
  const absPath = path.join(projectRoot, relPath);
  const ext = path.extname(relPath).toLowerCase();
  const stat = fs.statSync(absPath);
  if (BINARY_EXTS.has(ext)) {
    const buf = fs.readFileSync(absPath);
    return {
      path: relPath.split(path.sep).join("/"),
      type: "binary",
      size: stat.size,
      content: buf.toString("base64"),
    };
  }
  const buf = fs.readFileSync(absPath);
  let text = buf.toString("utf8");
  let truncated = false;
  if (buf.length > MAX_TEXT_BYTES) {
    text = text.slice(0, MAX_TEXT_BYTES) + "\n\n... [文件过大，预览已截断，但 zip 中为完整内容] ...";
    truncated = true;
  }
  return {
    path: relPath.split(path.sep).join("/"),
    type: "text",
    size: stat.size,
    content: text,
    fullBase64: truncated ? buf.toString("base64") : undefined,
  };
}

console.log("扫描项目文件...");
const relFiles = walk(projectRoot).sort();
console.log(`共 ${relFiles.length} 个文件，正在读取内容...`);

const fileEntries = relFiles.map(readFileEntry);

const textCount = fileEntries.filter((f) => f.type === "text").length;
const binCount = fileEntries.filter((f) => f.type === "binary").length;
console.log(`文本 ${textCount} 个，二进制 ${binCount} 个`);

const projectName = path.basename(projectRoot);
const dataJson = JSON.stringify({ projectName, files: fileEntries });

const jszipPath = path.join("/tmp", "jszip.min.js");
const jszipSource = fs.readFileSync(jszipPath, "utf8");

const html = buildHtml(projectName, dataJson, jszipSource);
const outPath = path.join(projectRoot, "项目浏览器.html");
fs.writeFileSync(outPath, html, "utf8");
const outSize = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`已生成: ${outPath} (${outSize} MB)`);

function buildHtml(name, dataJson, jszip) {
  // 用 base64 包裹数据，避免源码里的 </script> 等字符破坏 HTML
  const dataB64 = Buffer.from(dataJson, "utf8").toString("base64");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(name)} · 项目浏览器</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #0d1117; --panel: #161b22; --border: #30363d;
  --text: #e6edf3; --muted: #8b949e; --accent: #58a6ff;
  --hover: #1f242c; --active: #1f6feb33;
}
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
body { background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
header {
  height: 52px; flex: 0 0 52px; background: var(--panel); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between; padding: 0 16px;
}
header .title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
header .title .dot { color: var(--accent); }
header .actions { display: flex; align-items: center; gap: 10px; }
.btn {
  background: #238636; color: #fff; border: none; padding: 7px 14px; border-radius: 6px;
  font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;
}
.btn:hover { background: #2ea043; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn.secondary { background: #21262d; border: 1px solid var(--border); color: var(--text); }
.btn.secondary:hover { background: var(--hover); }
main { flex: 1; display: flex; min-height: 0; }
#sidebar {
  width: 320px; flex: 0 0 320px; background: var(--panel); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; min-height: 0;
}
.search { padding: 10px; border-bottom: 1px solid var(--border); }
.search input {
  width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 7px 10px; color: var(--text); font-size: 13px; outline: none;
}
.search input:focus { border-color: var(--accent); }
#tree { flex: 1; overflow-y: auto; padding: 6px 0; font-size: 13px; }
.node { user-select: none; }
.node-label {
  display: flex; align-items: center; gap: 5px; padding: 3px 10px; cursor: pointer; white-space: nowrap;
  border-radius: 4px; margin: 0 4px;
}
.node-label:hover { background: var(--hover); }
.node-label.active { background: var(--active); }
.node-label .icon { width: 16px; text-align: center; flex: 0 0 16px; color: var(--muted); }
.node-label .name { overflow: hidden; text-overflow: ellipsis; }
.dir > .children { display: none; }
.dir.open > .children { display: block; }
.dir > .node-label .twisty { transition: transform .12s; display: inline-block; }
.dir.open > .node-label .twisty { transform: rotate(90deg); }
#content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
#content-head {
  height: 40px; flex: 0 0 40px; border-bottom: 1px solid var(--border); display: flex;
  align-items: center; padding: 0 16px; gap: 12px; font-size: 13px; color: var(--muted); background: var(--panel);
}
#content-head .fpath { color: var(--text); font-weight: 500; }
#content-body { flex: 1; overflow: auto; }
pre { padding: 16px; font-family: "SF Mono", "Cascadia Code", Consolas, monospace; font-size: 12.5px; line-height: 1.6; white-space: pre; tab-size: 2; }
pre code { color: var(--text); }
.empty, .preview-binary { color: var(--muted); padding: 40px; text-align: center; font-size: 14px; }
.preview-binary img { max-width: 80%; max-height: 70vh; margin: 20px auto; display: block; border: 1px solid var(--border); border-radius: 6px; }
.linenums { display: flex; }
.linenums .nums { color: #484f58; text-align: right; padding: 16px 8px 16px 16px; user-select: none; border-right: 1px solid var(--border); }
.linenums .code-col { flex: 1; overflow-x: auto; }
.linenums .code-col pre { padding-left: 14px; }
#toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: #238636; color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 13px;
  opacity: 0; transition: opacity .25s; pointer-events: none; z-index: 999;
}
#toast.show { opacity: 1; }
.stats { font-size: 12px; color: var(--muted); padding: 8px 14px; border-top: 1px solid var(--border); }
</style>
</head>
<body>
<header>
  <div class="title"><span class="dot">●</span> ${escapeHtml(name)} <span style="color:var(--muted);font-weight:400;font-size:12px;">项目浏览器</span></div>
  <div class="actions">
    <button class="btn secondary" id="expandAllBtn">展开全部</button>
    <button class="btn secondary" id="collapseAllBtn">折叠全部</button>
    <button class="btn" id="downloadBtn">⬇ 一键下载 ZIP</button>
  </div>
</header>
<main>
  <aside id="sidebar">
    <div class="search"><input id="searchInput" type="text" placeholder="搜索文件名..." /></div>
    <div id="tree"></div>
    <div class="stats" id="stats"></div>
  </aside>
  <section id="content">
    <div id="content-head"><span class="fpath" id="fpath">未选择文件</span><span id="fmeta"></span></div>
    <div id="content-body"><div class="empty">← 在左侧点击一个文件查看内容</div></div>
  </section>
</main>
<div id="toast"></div>

<script>${jszip}</script>
<script>
const PROJECT_DATA = JSON.parse(decodeURIComponent(escape(atob("${dataB64}"))));
const files = PROJECT_DATA.files;
const fileMap = {};
files.forEach(f => { fileMap[f.path] = f; });

// 构建树结构
function buildTree(paths) {
  const root = { name: "", dirs: {}, files: [] };
  paths.forEach(p => {
    const parts = p.split("/");
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!cur.dirs[seg]) cur.dirs[seg] = { name: seg, dirs: {}, files: [] };
      cur = cur.dirs[seg];
    }
    cur.files.push({ name: parts[parts.length - 1], path: p });
  });
  return root;
}

const tree = buildTree(files.map(f => f.path));

function iconFor(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = { ts:"🟦", tsx:"⚛️", js:"🟨", mjs:"🟨", json:"🔧", md:"📄", css:"🎨", html:"🌐", py:"🐍", csv:"📊", xlsx:"📊", woff:"🔤", woff2:"🔤", ico:"🖼️", png:"🖼️", jpg:"🖼️", svg:"🖼️" };
  return map[ext] || "📄";
}

function renderDir(node, container, depth) {
  const dirNames = Object.keys(node.dirs).sort();
  dirNames.forEach(dn => {
    const dir = node.dirs[dn];
    const el = document.createElement("div");
    el.className = "node dir";
    const label = document.createElement("div");
    label.className = "node-label";
    label.style.paddingLeft = (10 + depth * 14) + "px";
    label.innerHTML = '<span class="twisty">▶</span><span class="icon">📁</span><span class="name">' + escapeHtmlJs(dn) + '</span>';
    label.onclick = () => el.classList.toggle("open");
    el.appendChild(label);
    const children = document.createElement("div");
    children.className = "children";
    renderDir(dir, children, depth + 1);
    el.appendChild(children);
    container.appendChild(el);
  });
  node.files.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(f => {
    const el = document.createElement("div");
    el.className = "node file";
    const label = document.createElement("div");
    label.className = "node-label";
    label.style.paddingLeft = (10 + depth * 14 + 16) + "px";
    label.dataset.path = f.path;
    label.innerHTML = '<span class="icon">' + iconFor(f.name) + '</span><span class="name">' + escapeHtmlJs(f.name) + '</span>';
    label.onclick = () => openFile(f.path, label);
    el.appendChild(label);
    container.appendChild(el);
  });
}

const treeEl = document.getElementById("tree");
renderDir(tree, treeEl, 0);

// 默认展开第一层目录
treeEl.querySelectorAll(":scope > .dir").forEach(d => d.classList.add("open"));

document.getElementById("stats").textContent = "共 " + files.length + " 个文件";

let activeLabel = null;
function openFile(p, label) {
  if (activeLabel) activeLabel.classList.remove("active");
  if (label) { label.classList.add("active"); activeLabel = label; }
  const f = fileMap[p];
  document.getElementById("fpath").textContent = p;
  document.getElementById("fmeta").textContent = "  ·  " + formatSize(f.size);
  const body = document.getElementById("content-body");
  if (f.type === "binary") {
    const ext = p.split(".").pop().toLowerCase();
    if (["png","jpg","jpeg","gif","webp","svg","ico"].includes(ext)) {
      const mime = ext === "svg" ? "image/svg+xml" : ("image/" + (ext==="jpg"?"jpeg":ext));
      body.innerHTML = '<div class="preview-binary"><img src="data:' + mime + ';base64,' + f.content + '" /><div>二进制图片文件（' + formatSize(f.size) + '）</div></div>';
    } else {
      body.innerHTML = '<div class="preview-binary">🔒 二进制文件（' + escapeHtmlJs(p) + '）<br><br>大小：' + formatSize(f.size) + '<br>已包含在下载的 ZIP 中。</div>';
    }
    return;
  }
  const lines = f.content.split("\\n");
  let nums = "";
  for (let i = 1; i <= lines.length; i++) nums += i + "\\n";
  body.innerHTML = '<div class="linenums"><pre class="nums">' + nums + '</pre><div class="code-col"><pre><code>' + escapeHtmlJs(f.content) + '</code></pre></div></div>';
}

// 搜索过滤
document.getElementById("searchInput").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  treeEl.querySelectorAll(".node.file").forEach(el => {
    const p = el.querySelector(".node-label").dataset.path.toLowerCase();
    el.style.display = !q || p.includes(q) ? "" : "none";
  });
  // 有搜索词时展开所有目录方便看
  if (q) treeEl.querySelectorAll(".dir").forEach(d => d.classList.add("open"));
});

document.getElementById("expandAllBtn").onclick = () => treeEl.querySelectorAll(".dir").forEach(d => d.classList.add("open"));
document.getElementById("collapseAllBtn").onclick = () => treeEl.querySelectorAll(".dir").forEach(d => d.classList.remove("open"));

// 一键下载 ZIP
document.getElementById("downloadBtn").onclick = async () => {
  const btn = document.getElementById("downloadBtn");
  btn.disabled = true; btn.textContent = "打包中...";
  try {
    const zip = new JSZip();
    const folder = zip.folder(PROJECT_DATA.projectName);
    files.forEach(f => {
      if (f.type === "binary") {
        folder.file(f.path, f.content, { base64: true });
      } else if (f.fullBase64) {
        folder.file(f.path, f.fullBase64, { base64: true });
      } else {
        folder.file(f.path, f.content);
      }
    });
    // 附一份 .env.local 占位，提示用户填 key
    folder.file(".env.local.PLEASE_FILL", "# 复制本文件为 .env.local 并填入你的 Key\\nDASHSCOPE_API_KEY=sk-your-key-here\\n");
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = PROJECT_DATA.projectName + ".zip";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("✓ 已下载 " + PROJECT_DATA.projectName + ".zip");
  } catch (err) {
    showToast("下载失败：" + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "⬇ 一键下载 ZIP";
  }
};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}
function formatSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1024*1024) return (n/1024).toFixed(1) + " KB";
  return (n/1024/1024).toFixed(2) + " MB";
}
function escapeHtmlJs(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
