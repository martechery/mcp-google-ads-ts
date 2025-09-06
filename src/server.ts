import { Server } from "@modelcontextprotocol/sdk/server";
import { registerTools } from "./server-tools.js";

// Basic MCP server using the official SDK (no fastmcp)
export async function startServer() {
  const server = new Server({
    name: "mcp-google-ads-gcloud-auth",
    version: "0.1.0",
  });
  registerTools(server);

  const { StdioServerTransport }: any = await import("@modelcontextprotocol/sdk/server/stdio");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
