import path from "node:path";
import { serveStdio, StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createPlatformMcpServer } from "./server";

// Resolve the ignored local config beside this checkout, not the host application's cwd.
process.chdir(path.resolve(__dirname, "../.."));
const handle = serveStdio(createPlatformMcpServer, {
  transport: new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 64 * 1024 }),
  onerror: () => { console.error("MCP 协议连接异常；未记录请求内容。"); },
});
process.on("SIGINT", () => { void handle.close(); });
process.on("SIGTERM", () => { void handle.close(); });
