import type { Random } from "./random.js";

/**
 * Appends a GS1 mod-10 check digit to a 17-digit payload, producing a valid
 * 18-digit SSCC (Serial Shipping Container Code).
 *
 * Algorithm: number the 17 digits from the rightmost position (1, 2, 3, ...),
 * multiply odd positions by 3 and even positions by 1, sum, then the check
 * digit is whatever brings that sum to the next multiple of 10.
 */
export function appendGs1CheckDigit(payload17: string): string {
  if (payload17.length !== 17 || !/^\d{17}$/.test(payload17)) {
    throw new Error(`appendGs1CheckDigit expects exactly 17 digits, got "${payload17}"`);
  }
  const digits = payload17.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const positionFromRight = digits.length - i; // 1-indexed
    const weight = positionFromRight % 2 === 1 ? 3 : 1;
    sum += (digits[i] as number) * weight;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return payload17 + String(checkDigit);
}

/**
 * Generates a deterministic, check-digit-valid SSCC-18: a 1-digit extension
 * digit followed by 16 digits standing in for a GS1 company prefix + serial
 * reference (this library doesn't hold a registered GS1 prefix — these are
 * fixtures, not real license plates), then the computed check digit.
 */
export function generateSscc18(rng: Random): string {
  const payload = rng.digits(17);
  return appendGs1CheckDigit(payload);
}
