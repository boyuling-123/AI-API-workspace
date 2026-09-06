import { McpServer } from "@modelcontextprotocol/server";
import { PLATFORM_ACTIONS } from "../lib/platformActions";
import { emptyActionInput, executePlatformAction, safeActionError } from "../server/platformActions";

export function createPlatformMcpServer() {
  const server = new McpServer({ name: "lu-eval-workbench", version: "0.1.0" });
  for (const action of PLATFORM_ACTIONS) {
    server.registerTool(action.name, {
      title: action.title, description: action.description, inputSchema: emptyActionInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => {
      try {
        const data = await executePlatformAction({ name: action.name, arguments: args });
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data };
      } catch (reason) {
        const error = safeActionError(reason);
        return { isError: true, content: [{ type: "text" as const, text: error.message }], structuredContent: { code: error.code } };
      }
    });
  }
  return server;
}
