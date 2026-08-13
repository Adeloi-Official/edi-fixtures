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
 */
export function generateOrderLines(rng: Random, count: number): OrderLine[] {
  const lines: OrderLine[] = [];
  for (let lineNumber = 1; lineNumber <= count; lineNumber++) {
    lines.push({
      lineNumber,
      quantity: rng.crooked(3, 480),
      uom: rng.pick(UOM_CODES),
      price: rng.crooked(1.1, 249.99, 2),
      partNumber: `${rng.pick(PART_NUMBER_PREFIXES)}-${rng.digits(5)}`,
      description: rng.pick(PRODUCT_DESCRIPTIONS),
    });
  }
  return lines;
}
