import { padLeft, padRight } from "./format.js";
import { dateFromSeed, formatDateCCYYMMDD, formatDateYYMMDD, formatTimeHHMM } from "./dates.js";
import type { Random } from "./random.js";
import type { EdiDocument, Segment, Separators } from "./model.js";

/**
 * A trading partner's interchange-level and content-level requirements.
 *
 * This is intentionally generic. It is NOT a substitute for a partner's real
 * implementation guide (those are proprietary and out of scope here) — it's
 * enough shape to parametrize a document without pretending to be Walmart's
 * or Grainger's spec.
 */
export interface PartnerProfile {
  isaQualifier: string;
  senderId: string;
  receiverId: string;
  requiredRefs?: string[];
  uomWhitelist?: string[];
  usageIndicator?: "P" | "T";
}

export const defaultPartner: PartnerProfile = {
  isaQualifier: "ZZ",
  senderId: "SENDERID",
  receiverId: "RECEIVERID",
  usageIndicator: "P",
};

export function definePartner(overrides: Partial<PartnerProfile>): PartnerProfile {
  return { ...defaultPartner, ...overrides };
}

/** Functional Identifier Codes (GS01) for the document types this library generates. */
export const FUNCTIONAL_GROUP: Record<string, string> = {
  "850": "PO",
  "855": "PR",
  "856": "SH",
  "810": "IN",
  "997": "FA",
};

export interface EnvelopeOptions {
  docType: keyof typeof FUNCTIONAL_GROUP;
  rng: Random;
  partner?: PartnerProfile;
  /** Overrides the seed-derived date. Scenarios use this to keep PO → ACK → ASN → Invoice chronologically ordered. */
  referenceDate?: Date;
}

export interface EnvelopeResult {
  /** Wraps business segments with ISA/GS/ST ... SE/GE/IEA using this envelope's control numbers and date. */
  wrap: (businessSegments: Segment[]) => EdiDocument;
  date: Date;
  controlNumbers: { isa: string; group: string; transaction: string };
}

/** ISA is fixed-width: exactly 106 characters, including the segment terminator. */
export function buildEnvelope(opts: EnvelopeOptions): EnvelopeResult {
  const partner = opts.partner ?? defaultPartner;
  const date = opts.referenceDate ?? dateFromSeed(opts.rng);
  const isaControl = padLeft(String(opts.rng.int(1, 999_999_999)), 9);
  const groupControl = String(opts.rng.int(1, 999_999));
  const transactionControl = "0001";
  const functionalId = FUNCTIONAL_GROUP[opts.docType];
  const separators: Separators = { element: "*", segment: "~", sub: ":" };

  function wrap(businessSegments: Segment[]): EdiDocument {
    const isa: Segment = [
      "ISA",
      "00",
      padRight("", 10),
      "00",
      padRight("", 10),
      partner.isaQualifier,
      padRight(partner.senderId, 15),
      partner.isaQualifier,
      padRight(partner.receiverId, 15),
      formatDateYYMMDD(date),
      formatTimeHHMM(opts.rng),
      "U",
      "00401",
      isaControl,
      "0",
      partner.usageIndicator ?? "P",
      separators.sub,
    ];
    const gs: Segment = [
      "GS",
      functionalId as string,
      partner.senderId,
      partner.receiverId,
      formatDateCCYYMMDD(date),
      formatTimeHHMM(opts.rng),
      groupControl,
      "X",
      "004010",
    ];
    const st: Segment = ["ST", opts.docType, transactionControl];
    const se: Segment = ["SE", String(businessSegments.length + 2), transactionControl];
    const ge: Segment = ["GE", "1", groupControl];
    const iea: Segment = ["IEA", "1", isaControl];

    return {
      segments: [isa, gs, st, ...businessSegments, se, ge, iea],
      separators,
      meta: {
        docType: opts.docType,
        controlNumbers: { isa: isaControl, group: groupControl, transaction: transactionControl },
        date,
      },
    };
  }

  return { wrap, date, controlNumbers: { isa: isaControl, group: groupControl, transaction: transactionControl } };
}
