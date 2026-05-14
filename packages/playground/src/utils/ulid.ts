// SPDX-License-Identifier: Apache-2.0

/**
 * Crockford Base32 alphabet used by ULID.
 * The first 10 characters of a ULID encode the creation timestamp in ms.
 */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Extract the creation Date from a ULID string. Returns null if the input is not a valid ULID. */
export function ulidToDate(ulid: string): Date | null {
  if (!ulid || ulid.length < 10) return null;
  try {
    let time = 0;
    for (const char of ulid.slice(0, 10).toUpperCase()) {
      const idx = ENCODING.indexOf(char);
      if (idx === -1) return null;
      time = time * 32 + idx;
    }
    return new Date(time);
  } catch {
    return null;
  }
}

/** Format a ULID's embedded timestamp as a short human-readable string, e.g. "Nov 12, 14:03". */
export function formatUlidDate(ulid: string): string {
  const d = ulidToDate(ulid);
  if (!d) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
