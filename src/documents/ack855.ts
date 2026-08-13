import { Random } from "../random.js";
import { padLeft, money2 } from "../format.js";
import { formatDateCCYYMMDD } from "../dates.js";
import { buildEnvelope, type PartnerProfile } from "../envelope.js";
import { createBuilder, type DocBuilder } from "../builder.js";
import type { EdiDocument, Segment } from "../model.js";
import { COMPANY_NAMES } from "../data.js";
import { generateOrderLines, type OrderLine } from "../types.js";

export interface Ack855Options {
  seed: number;
  lines?: number;
  poNumber?: string;
  partner?: PartnerProfile;
  referenceDate?: Date;
}

export interface Ack855Built {
  segments: Segment[];
  poNumber: string;
  lines: OrderLine[];
  date: Date;
  wrap: (segments: Segment[]) => EdiDocument;
}

/** @internal Shared by the standalone `ack855()` builder and `scenario.orderToInvoice()`. */
export function buildAck855(
  rng: Random,
  opts: { poNumber: string; lines: OrderLine[]; partner?: PartnerProfile; referenceDate?: Date },
): Ack855Built {
  const envelope = buildEnvelope({ docType: "855", rng, partner: opts.partner, referenceDate: opts.referenceDate });

  const segments: Segment[] = [
    // BAK02 "AC" = Acknowledge - With Detail, Change. Every line is accepted as ordered in the happy path.
    ["BAK", "00", "AC", opts.poNumber, "", formatDateCCYYMMDD(envelope.date)],
    ["REF", "DP", padLeft(String(rng.int(1, 999)), 3)],
    ["N1", "ST", rng.pick(COMPANY_NAMES), "92", `LOC${rng.digits(4)}`],
    ...opts.lines.flatMap((l): Segment[] => [
      ["PO1", String(l.lineNumber), String(l.quantity), l.uom, money2(l.price), "PE", "BP", l.partNumber],
      // ACK01 "IA" = Item Accepted.
      ["ACK", "IA", String(l.quantity), l.uom],
    ]),
    ["CTT", String(opts.lines.length)],
  ];

  return { segments, poNumber: opts.poNumber, lines: opts.lines, date: envelope.date, wrap: envelope.wrap };
}

/** An 855 PO Acknowledgment: seller -> buyer, "here's what I'm actually going to ship". */
export function ack855(options: Ack855Options): DocBuilder {
  return createBuilder(() => {
    const rng = new Random(options.seed);
    const lines = generateOrderLines(rng, options.lines ?? 3);
    const poNumber = options.poNumber ?? `PO${padLeft(String(rng.int(1, 999_999)), 6)}`;
    const built = buildAck855(rng, {
      poNumber,
      lines,
      partner: options.partner,
      referenceDate: options.referenceDate,
    });
    return built.wrap(built.segments);
  });
}
