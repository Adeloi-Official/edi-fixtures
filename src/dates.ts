import { padLeft } from "./format.js";
import type { Random } from "./random.js";

/**
 * Fixed epoch used when a document doesn't specify a `referenceDate`.
 *
 * This is deliberately NOT `Date.now()`. Dates are derived from the seed
 * plus this constant anchor, so a document generated today and the same
 * document generated five years from now are byte-identical. Determinism
 * is the product; the system clock is the enemy of the product.
 */
const SEED_EPOCH_UTC = Date.UTC(2024, 0, 1);

/** A deterministic date within `spreadDays` of the fixed epoch, driven by `rng`. */
export function dateFromSeed(rng: Random, spreadDays = 120): Date {
  const offsetDays = rng.int(0, spreadDays);
  return new Date(SEED_EPOCH_UTC + offsetDays * 86_400_000);
}

/** Adds (or subtracts, if negative) whole days to a Date, in UTC. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** CCYYMMDD, the standard X12 004010 date format (DTM, BEG, BAK, BIG, BSN, ...). */
export function formatDateCCYYMMDD(date: Date): string {
  const y = String(date.getUTCFullYear());
  const m = padLeft(String(date.getUTCMonth() + 1), 2);
  const d = padLeft(String(date.getUTCDate()), 2);
  return `${y}${m}${d}`;
}

/** YYMMDD — the two-digit-year format ISA09 requires (and DTM should NOT use; see faults.dateFormatShort). */
export function formatDateYYMMDD(date: Date): string {
  return formatDateCCYYMMDD(date).slice(2);
}

/** HHMM, driven by `rng` so it's deterministic rather than reading the wall clock. */
export function formatTimeHHMM(rng: Random): string {
  return padLeft(String(rng.int(0, 23)), 2) + padLeft(String(rng.int(0, 59)), 2);
}
