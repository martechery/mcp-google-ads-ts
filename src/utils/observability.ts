import { MCPEvent } from '../types/observability.js';

export function emitMcpEvent(evt: MCPEvent): void {
  try {
    const line = JSON.stringify(evt);
    // eslint-disable-next-line no-console
    process.stderr.write(line + '\n');
  } catch {
    // swallow
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

