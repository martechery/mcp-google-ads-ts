function getByPath(obj: any, path: string): any {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(rows: any[], fields: string[]): string {
  const header = fields.join(',');
  const lines = [header];
  for (const r of rows) {
    const vals = fields.map((f) => csvEscape(getByPath(r, f)));
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

