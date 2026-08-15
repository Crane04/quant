const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses a duration string like "15m", "7d", "30d" into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration string: "${value}"`);
  return Number(match[1]) * UNIT_MS[match[2]];
}
