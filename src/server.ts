import type { Server as BaseServer } from "@modelcontextprotocol/sdk/server";
import { registerTools } from "./server-tools.js";

// Basic MCP server using the official SDK (no fastmcp)
export async function startServer() {
  let McpServer: any;
  try {
    ({ McpServer } = await import("@modelcontextprotocol/sdk/server/mcp" as any));
  } catch {
    ({ McpServer } = await import("@modelcontextprotocol/sdk/dist/esm/server/mcp.js" as any));
  }
  const server: BaseServer = new McpServer({ name: "mcp-google-ads-gcloud-auth", version: "0.1.0" });
  registerTools(server as any);
  const { StdioServerTransport }: any = await import("@modelcontextprotocol/sdk/server/stdio");
  const transport = new StdioServerTransport();
  await (server as any).connect(transport);
}
