import { Random } from "../random.js";
import { padLeft, money2 } from "../format.js";
import { formatDateCCYYMMDD } from "../dates.js";
import { buildEnvelope, buildRequiredRefSegments, type PartnerProfile } from "../envelope.js";
import { createBuilder, type DocBuilder } from "../builder.js";
import type { EdiDocument, Segment } from "../model.js";
import { CITY_STATE, COMPANY_NAMES } from "../data.js";
import { generateOrderLines, type OrderLine } from "../types.js";

export interface Po850Options {
  seed: number;
  lines?: number;
  poNumber?: string;
  partner?: PartnerProfile;
  referenceDate?: Date;
}

export interface Po850Built {
  segments: Segment[];
  poNumber: string;
  lines: OrderLine[];
  date: Date;
  wrap: (segments: Segment[]) => EdiDocument;
}

/**
 * @internal Shared by the standalone `po850()` builder and `scenario.orderToInvoice()`,
 * which supplies its own already-generated `lines`/`poNumber` so the whole flow stays consistent.
 */
export function buildPo850(
  rng: Random,
  opts: { poNumber?: string; lines: OrderLine[]; partner?: PartnerProfile; referenceDate?: Date },
): Po850Built {
  const envelope = buildEnvelope({ docType: "850", rng, partner: opts.partner, referenceDate: opts.referenceDate });
  const poNumber = opts.poNumber ?? `PO${padLeft(String(rng.int(1, 999_999)), 6)}`;
  const city = rng.pick(CITY_STATE);
  const requestedShipDate = new Date(envelope.date.getTime() + rng.int(3, 14) * 86_400_000);

  const segments: Segment[] = [
    ["BEG", "00", "NE", poNumber, "", formatDateCCYYMMDD(envelope.date)],
    ...buildRequiredRefSegments(rng, opts.partner),
    ["DTM", "002", formatDateCCYYMMDD(requestedShipDate)],
    ["N1", "ST", rng.pick(COMPANY_NAMES), "92", `LOC${rng.digits(4)}`],
    ["N3", `${rng.int(100, 9999)} Industrial Pkwy`],
    ["N4", city.city, city.state, city.zip],
    ...opts.lines.flatMap((l): Segment[] => [
      ["PO1", String(l.lineNumber), String(l.quantity), l.uom, money2(l.price), "PE", "BP", l.partNumber],
      ["PID", "F", "", "", "", l.description],
    ]),
    ["CTT", String(opts.lines.length)],
  ];

  return { segments, poNumber, lines: opts.lines, date: envelope.date, wrap: envelope.wrap };
}

/** An 850 Purchase Order: buyer -> seller, "please ship me this". */
export function po850(options: Po850Options): DocBuilder {
  return createBuilder(() => {
    const rng = new Random(options.seed);
    const lines = generateOrderLines(rng, options.lines ?? 3, options.partner?.uomWhitelist);
    const built = buildPo850(rng, {
      poNumber: options.poNumber,
      lines,
      partner: options.partner,
      referenceDate: options.referenceDate,
    });
    return built.wrap(built.segments);
  });
}
