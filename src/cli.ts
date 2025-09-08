#!/usr/bin/env node

// Parse --env arguments before starting server
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--env' && i + 1 < args.length) {
    const envVar = args[i + 1];
    const [key, value] = envVar.split('=', 2);
    if (key && value !== undefined) {
      process.env[key] = value;
    }
    i++; // skip the next argument since we consumed it
  }
}

import { startServer } from "./server.js";

startServer().catch((err) => {
  // Do not exit hard on startup to avoid client disconnect loops
  console.error("MCP server failed to start:", err?.message || err);
});

