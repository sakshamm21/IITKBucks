/** Shared formatting helpers. */

/**
 * IITkBucks has no decimal places in its coin model — coins are BigInt throughout
 * the backend and the binary format uses int64. Formatting with a fixed 2-decimal
 * treatment would imply a precision the protocol does not have, so amounts are
 * rendered as whole units with thousands separators.
 */
export function formatCoins(value: bigint | string | number): string {
  let n: bigint;
  try {
    n = BigInt(value);
  } catch {
    return '0';
  }
  const negative = n < 0n;
  const digits = (negative ? -n : n).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return negative ? `-${grouped}` : grouped;
}

/** Compact display for large balances: 1.2M, 340K. */
export function formatCompact(value: bigint | string | number): string {
  let n: bigint;
  try {
    n = BigInt(value);
  } catch {
    return '0';
  }
  const abs = n < 0n ? -n : n;
  const units: [bigint, string][] = [
    [1_000_000_000n, 'B'],
    [1_000_000n, 'M'],
    [1_000n, 'K'],
  ];
  for (const [div, suffix] of units) {
    if (abs >= div) {
      const whole = n / div;
      const frac = ((n % div) * 10n) / div;
      return frac > 0n ? `${whole}.${frac}${suffix}` : `${whole}${suffix}`;
    }
  }
  return n.toString();
}

export function shortHash(hash: string, lead = 6, tail = 4): string {
  if (!hash || hash.length <= lead + tail + 1) return hash || '';
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

/** Relative time for recent block timestamps. */
export function timeAgo(unixNanos: bigint): string {
  // Backend timestamps come from nano-time.
  const ms = Number(unixNanos / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return 'unknown';
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatDateTime(unixNanos: bigint): string {
  const ms = Number(unixNanos / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return new Date(ms).toLocaleString();
}

/** Validate an alias against the same rule the node enforces. */
export function isValidAlias(alias: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(alias);
}
