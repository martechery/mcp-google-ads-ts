export function tabulate(rows: any[], fieldPaths: string[]): string {
  // Compute widths from header and row values
  const widths: Record<string, number> = {};
  for (const f of fieldPaths) widths[f] = Math.max(widths[f] || 0, f.length);

  const getVal = (row: any, path: string) => {
    if (path.includes('.')) {
      const [p, c] = path.split('.');
      return String((row?.[p] ?? {})?.[c] ?? '');
    }
    return String(row?.[path] ?? '');
  };

  for (const row of rows) {
    for (const f of fieldPaths) {
      const val = getVal(row, f);
      widths[f] = Math.max(widths[f], val.length);
    }
  }

  const pad = (s: string, n: number) => s.padEnd(n, ' ');
  const header = fieldPaths.map(f => pad(f, widths[f])).join(' | ');
  const sep = '-'.repeat(header.length);
  const lines = [header, sep];
  for (const row of rows) {
    const cells = fieldPaths.map(f => pad(getVal(row, f), widths[f]));
    lines.push(cells.join(' | '));
  }
  return lines.join('\n');
}

