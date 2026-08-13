import { Random } from "../random.js";
import { padLeft, money2 } from "../format.js";
import { formatDateCCYYMMDD } from "../dates.js";
import { buildEnvelope, buildRequiredRefSegments, type PartnerProfile } from "../envelope.js";
import { createBuilder, type DocBuilder } from "../builder.js";
import type { EdiDocument, Segment } from "../model.js";
import { CITY_STATE, COMPANY_NAMES } from "../data.js";
import { generateOrderLines, type OrderLine } from "../types.js";

export interface Invoice810Options {
  seed: number;
  lines?: number;
  poNumber?: string;
  poDate?: Date;
  partner?: PartnerProfile;
  referenceDate?: Date;
}

export interface Invoice810Built {
  segments: Segment[];
  poNumber: string;
  invoiceNumber: string;
  lines: OrderLine[];
  date: Date;
  wrap: (segments: Segment[]) => EdiDocument;
}

/** @internal Shared by the standalone `invoice810()` builder and `scenario.orderToInvoice()`. */
export function buildInvoice810(
  rng: Random,
  opts: {
    poNumber: string;
    poDate?: Date;
    lines: OrderLine[];
    partner?: PartnerProfile;
    referenceDate?: Date;
  },
): Invoice810Built {
  const envelope = buildEnvelope({ docType: "810", rng, partner: opts.partner, referenceDate: opts.referenceDate });
  const invoiceNumber = `INV${rng.digits(6)}`;
  const poDate = opts.poDate ?? envelope.date;
  const city = rng.pick(CITY_STATE);
  const totalCents = Math.round(opts.lines.reduce((sum, l) => sum + l.quantity * l.price, 0) * 100);

  const segments: Segment[] = [
    ["BIG", formatDateCCYYMMDD(envelope.date), invoiceNumber, formatDateCCYYMMDD(poDate), opts.poNumber],
    ...buildRequiredRefSegments(rng, opts.partner),
    ["N1", "ST", rng.pick(COMPANY_NAMES), "92", `LOC${rng.digits(4)}`],
    ["N4", city.city, city.state, city.zip],
    ...opts.lines.map((l): Segment => ["IT1", String(l.lineNumber), String(l.quantity), l.uom, money2(l.price), "PE", "BP", l.partNumber]),
    ["TDS", String(totalCents)], // Total invoice amount, in cents (implied 2 decimals) — see faults.impliedDecimals
    ["CTT", String(opts.lines.length)],
  ];

  return { segments, poNumber: opts.poNumber, invoiceNumber, lines: opts.lines, date: envelope.date, wrap: envelope.wrap };
}

/** An 810 Invoice: seller -> buyer, "here's what you owe for that PO". */
export function invoice810(options: Invoice810Options): DocBuilder {
  return createBuilder(() => {
    const rng = new Random(options.seed);
    const lines = generateOrderLines(rng, options.lines ?? 3, options.partner?.uomWhitelist);
    const poNumber = options.poNumber ?? `PO${padLeft(String(rng.int(1, 999_999)), 6)}`;
    const built = buildInvoice810(rng, {
      poNumber,
      poDate: options.poDate,
      lines,
      partner: options.partner,
      referenceDate: options.referenceDate,
    });
    return built.wrap(built.segments);
  });
}
