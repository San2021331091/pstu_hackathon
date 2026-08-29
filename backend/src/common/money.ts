/**
 * Money utilities. We NEVER represent money as a float.
 * Internally everything is BigInt poisha (1 taka = 100 poisha).
 * We only convert to a human string at the very edge (API response / UI).
 */

export const POISHA_PER_TAKA = 100n;

/** Parse a user-entered taka amount ("2500", "2500.50") into BigInt poisha. */
export function takaToPoisha(input: string | number): bigint {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error('Invalid amount format');
  }
  const [whole, frac = ''] = s.split('.');
  const fracPadded = (frac + '00').slice(0, 2); // pad/truncate to 2 dp
  return BigInt(whole) * POISHA_PER_TAKA + BigInt(fracPadded);
}

/** Format BigInt poisha as a taka string, e.g. 250000n -> "2,500.00". */
export function poishaToTaka(poisha: bigint): string {
  const neg = poisha < 0n;
  const abs = neg ? -poisha : poisha;
  const taka = abs / POISHA_PER_TAKA;
  const frac = abs % POISHA_PER_TAKA;
  const takaStr = taka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${takaStr}.${frac.toString().padStart(2, '0')}`;
}

/** Safe JSON: BigInt -> string, so the API never throws on serialization. */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

import { createHash } from 'crypto';

/**
 * Deterministic SHA-256 for the tamper-evident ledger hash-chain (F6).
 * hash = sha256(prevHash | seq-independent entry fields). Each entry commits
 * to the previous hash, so editing any past row breaks every hash after it.
 */
export function ledgerHash(input: {
  prevHash: string;
  accountId: string;
  type: string;
  amount: bigint;
  balanceAfter: bigint;
  transferId?: string | null;
  memo?: string | null;
  createdAtIso: string;
}): string {
  const payload = [
    input.prevHash,
    input.accountId,
    input.type,
    input.amount.toString(),
    input.balanceAfter.toString(),
    input.transferId ?? '',
    input.memo ?? '',
    input.createdAtIso,
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

export const GENESIS_HASH = '0'.repeat(64);
