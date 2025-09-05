import { spawn } from 'node:child_process';

export type ExecResult = { code: number | null; stdout: string; stderr: string };

export function execCmd(cmd: string, args: string[], options: { timeoutMs?: number } = {}): Promise<ExecResult> {
  const { timeoutMs = 60_000 } = options;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      // Attempt to terminate if still running; ignore failures
      if (!child.killed) {
        try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
      }
    }, timeoutMs);
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: `Failed to start ${cmd}` });
    });
  });
}
