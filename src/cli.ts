#!/usr/bin/env node
import { startServer } from "./server.js";

startServer().catch((err) => {
  // Do not exit hard on startup to avoid client disconnect loops
  console.error("MCP server failed to start:", err?.message || err);
});

