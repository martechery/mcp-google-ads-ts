import { MCPEvent } from '../types/observability.js';

function isEnabled(): boolean {
  const flag = (process.env.OBSERVABILITY_ENABLED || '').toLowerCase();
  const level = (process.env.OBSERVABILITY || '').toLowerCase();
  if (flag === 'false' || flag === '0' || level === 'off' || level === 'none') return false;
  return true;
}

export function emitMcpEvent(evt: MCPEvent): void {
  try {
    if (!isEnabled()) return;
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
