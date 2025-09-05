export function microsToUnits(micros: number, decimals = 2): number {
  if (!Number.isFinite(micros)) return 0;
  const units = micros / 1_000_000;
  const factor = Math.pow(10, decimals);
  return Math.round(units * factor) / factor;
}

