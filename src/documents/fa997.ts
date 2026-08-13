import { Random } from "../random.js";
import { buildEnvelope, FUNCTIONAL_GROUP, type PartnerProfile } from "../envelope.js";
import { createBuilder, type DocBuilder } from "../builder.js";
import type { ControlNumbers, EdiDocument, Segment } from "../model.js";

/** The interchange/group/transaction this 997 is acknowledging. */
export interface Fa997Target {
  /** GS01 of the group being acknowledged, e.g. "PO" for an 850. */
  functionalIdCode: string;
  /** GS06 of the group being acknowledged. */
  groupControlNumber: string;
  /** ST01 of the transaction set being acknowledged, e.g. "850". */
  transactionSetId: string;
  /** ST02 of the transaction set being acknowledged. */
  transactionSetControlNumber: string;
}

export interface Fa997Options {
  seed: number;
  target: Fa997Target;
  partner?: PartnerProfile;
  referenceDate?: Date;
}

export interface Fa997Built {
  segments: Segment[];
  date: Date;
  wrap: (segments: Segment[]) => EdiDocument;
}

/** @internal Shared by the standalone `fa997()` builder and `scenario.orderToInvoice()`. */
export function buildFa997(
  rng: Random,
  opts: { target: Fa997Target; partner?: PartnerProfile; referenceDate?: Date },
): Fa997Built {
  const envelope = buildEnvelope({ docType: "997", rng, partner: opts.partner, referenceDate: opts.referenceDate });

  const segments: Segment[] = [
    ["AK1", opts.target.functionalIdCode, opts.target.groupControlNumber],
    ["AK2", opts.target.transactionSetId, opts.target.transactionSetControlNumber],
    ["AK5", "A"], // Transaction Set Ack Code: A = Accepted
    ["AK9", "A", "1", "1", "1"], // Functional Group Ack Code: A = Accepted; 1 included, 1 received, 1 accepted
  ];

  return { segments, date: envelope.date, wrap: envelope.wrap };
}

/**
 * Builds a `Fa997Target` from the control numbers of a document this 997 is
 * acknowledging. `transactionSetId` is the document's own ST01 (e.g. "850") —
 * its GS01 functional ID is looked up from the same table `buildEnvelope`
 * uses, so the two can never drift apart.
 */
export function targetFrom(transactionSetId: string, controlNumbers: ControlNumbers): Fa997Target {
  return {
    functionalIdCode: FUNCTIONAL_GROUP[transactionSetId] ?? "PO",
    groupControlNumber: controlNumbers.group,
    transactionSetId,
    transactionSetControlNumber: controlNumbers.transaction,
  };
}

/** A 997 Functional Acknowledgment: "your interchange arrived and parsed at the group level" — nothing more. */
export function fa997(options: Fa997Options): DocBuilder {
  return createBuilder(() => {
    const rng = new Random(options.seed);
    const built = buildFa997(rng, { target: options.target, partner: options.partner, referenceDate: options.referenceDate });
    return built.wrap(built.segments);
  });
}
