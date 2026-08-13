import { Random } from "../random.js";
import { formatDateCCYYMMDD, formatTimeHHMM } from "../dates.js";
import { buildEnvelope, type PartnerProfile } from "../envelope.js";
import { createBuilder, type DocBuilder } from "../builder.js";
import type { EdiDocument, Segment } from "../model.js";
import { CARRIER_NAMES, CITY_STATE, COMPANY_NAMES, SCAC_CODES } from "../data.js";
import { generateOrderLines, type OrderLine } from "../types.js";
import { generateSscc18 } from "../gs1.js";

export interface Asn856Options {
  seed: number;
  lines?: number;
  poNumber?: string;
  partner?: PartnerProfile;
  referenceDate?: Date;
}

export interface Asn856Built {
  segments: Segment[];
  poNumber: string;
  lines: OrderLine[];
  date: Date;
  wrap: (segments: Segment[]) => EdiDocument;
}

/**
 * @internal Shared by the standalone `asn856()` builder and `scenario.orderToInvoice()`.
 *
 * HL hierarchy: Shipment (S, id 1) -> Order (O, id 2, parent 1) -> Pack (P, id 3, parent 2)
 * -> one Item (I, parent 3) per order line. This is the shape `faults.hlOrphan()` breaks.
 */
export function buildAsn856(
  rng: Random,
  opts: { poNumber: string; lines: OrderLine[]; partner?: PartnerProfile; referenceDate?: Date },
): Asn856Built {
  const envelope = buildEnvelope({ docType: "856", rng, partner: opts.partner, referenceDate: opts.referenceDate });
  const shipDate = envelope.date;
  const estimatedDeliveryDate = new Date(shipDate.getTime() + rng.int(2, 6) * 86_400_000);
  const scac = rng.pick(SCAC_CODES);
  const city = rng.pick(CITY_STATE);
  const sscc = generateSscc18(rng);
  const shipmentId = `SH${rng.digits(6)}`;

  const itemSegments: Segment[] = opts.lines.flatMap((l): Segment[] => {
    const hlId = String(3 + l.lineNumber);
    return [
      ["HL", hlId, "3", "I"],
      ["LIN", String(l.lineNumber), "BP", l.partNumber],
      ["SN1", "", String(l.quantity), l.uom],
    ];
  });

  const segments: Segment[] = [
    ["BSN", "00", shipmentId, formatDateCCYYMMDD(shipDate), formatTimeHHMM(rng)],
    ["HL", "1", "", "S"],
    ["TD5", "", "2", scac, "M", CARRIER_NAMES[scac] ?? scac],
    ["TD1", "CTN25", String(opts.lines.length)],
    ["REF", "BM", `BOL${rng.digits(7)}`],
    ["DTM", "011", formatDateCCYYMMDD(shipDate)], // Shipped date
    ["DTM", "017", formatDateCCYYMMDD(estimatedDeliveryDate)], // Estimated delivery date
    ["N1", "ST", rng.pick(COMPANY_NAMES), "92", `LOC${rng.digits(4)}`],
    ["N4", city.city, city.state, city.zip],
    ["HL", "2", "1", "O"],
    ["PRF", opts.poNumber],
    ["HL", "3", "2", "P"],
    ["MAN", "GM", sscc], // GM = SSCC-18, Serial Shipping Container Code
    ...itemSegments,
    ["CTT", String(opts.lines.length)],
  ];

  return { segments, poNumber: opts.poNumber, lines: opts.lines, date: envelope.date, wrap: envelope.wrap };
}

/** An 856 Advance Ship Notice: seller -> buyer, "here's what's on the truck and how it's packed". */
export function asn856(options: Asn856Options): DocBuilder {
  return createBuilder(() => {
    const rng = new Random(options.seed);
    const lines = generateOrderLines(rng, options.lines ?? 3);
    const poNumber = options.poNumber ?? `PO${String(rng.int(1, 999_999)).padStart(6, "0")}`;
    const built = buildAsn856(rng, {
      poNumber,
      lines,
      partner: options.partner,
      referenceDate: options.referenceDate,
    });
    return built.wrap(built.segments);
  });
}
