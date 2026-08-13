import type { Random } from "./random.js";
import { PART_NUMBER_PREFIXES, PRODUCT_DESCRIPTIONS, UOM_CODES } from "./data.js";

/** One purchase-order line, shared verbatim across a scenario's PO/ACK/ASN/Invoice. */
export interface OrderLine {
  lineNumber: number;
  quantity: number;
  uom: string;
  price: number;
  partNumber: string;
  description: string;
}

/**
 * Generates `count` plausible order lines: crooked quantities, mixed UOMs,
 * non-round prices — the opposite of the one-line, round-number examples in
 * implementation guides.
 *
 * `uomPool` narrows which UOM codes get picked — pass a partner's
 * `uomWhitelist` so a generated document never uses a code that partner
 * doesn't accept.
 */
export function generateOrderLines(rng: Random, count: number, uomPool: readonly string[] = UOM_CODES): OrderLine[] {
  // Shuffled once per document, then assigned round-robin — guarantees no two
  // lines share a description as long as count <= the pool size (10), instead
  // of independently sampling with replacement and risking duplicates on
  // small line counts, which undercut the "realistic data" promise.
  const descriptions = rng.shuffled(PRODUCT_DESCRIPTIONS);
  const lines: OrderLine[] = [];
  for (let lineNumber = 1; lineNumber <= count; lineNumber++) {
    lines.push({
      lineNumber,
      quantity: rng.crooked(3, 480),
      uom: rng.pick(uomPool.length > 0 ? uomPool : UOM_CODES),
      price: rng.crooked(1.1, 249.99, 2),
      partNumber: `${rng.pick(PART_NUMBER_PREFIXES)}-${rng.digits(5)}`,
      description: descriptions[(lineNumber - 1) % descriptions.length] as string,
    });
  }
  return lines;
}
