import { Random } from "./random.js";
import { padLeft } from "./format.js";
import { addDays } from "./dates.js";
import { generateOrderLines } from "./types.js";
import { buildPo850 } from "./documents/po850.js";
import { buildAck855 } from "./documents/ack855.js";
import { buildAsn856 } from "./documents/asn856.js";
import { buildInvoice810 } from "./documents/invoice810.js";
import { buildFa997, targetFrom } from "./documents/fa997.js";
import { serialize, type EdiDocument } from "./model.js";
import type { PartnerProfile } from "./envelope.js";

export interface OrderToInvoiceOptions {
  seed: number;
  lines?: number;
  partner?: PartnerProfile;
}

/** The five documents of an order-to-invoice flow, before serialization — what scenario faults operate on. */
export interface ScenarioBundle {
  po: EdiDocument;
  ack: EdiDocument;
  asn: EdiDocument;
  invoice: EdiDocument;
  fa: EdiDocument | null;
}

export type ScenarioFault = (bundle: ScenarioBundle) => ScenarioBundle;

export interface ScenarioResult {
  po: string;
  ack: string;
  asn: string;
  invoice: string;
  /** `null` when `faults.fa997Missing()` was applied. */
  fa: string | null;
}

export interface ScenarioBuilder {
  with(fault: ScenarioFault): ScenarioBuilder;
  build(): ScenarioResult;
}

/**
 * A consistent PO -> Acknowledgment -> ASN -> Invoice -> 997 chain: same PO
 * number, same line items (quantity, UOM, price, part number) end to end,
 * dates that move forward document to document, and a 997 that correctly
 * references the PO's own group/transaction control numbers.
 *
 * Each document is still its own independent interchange with its own ISA/GS/ST
 * control numbers, exactly as five separate EDI transmissions would be in reality.
 */
export function orderToInvoice(options: OrderToInvoiceOptions): ScenarioBuilder {
  const scenarioFaults: ScenarioFault[] = [];

  const api: ScenarioBuilder = {
    with(fault) {
      scenarioFaults.push(fault);
      return api;
    },
    build() {
      const rootRng = new Random(options.seed);
      const lines = generateOrderLines(rootRng, options.lines ?? 3, options.partner?.uomWhitelist);
      const poNumber = `PO${padLeft(String(rootRng.int(1, 999_999)), 6)}`;

      const poBuilt = buildPo850(new Random(options.seed + 1), { poNumber, lines, partner: options.partner });
      const poDoc = poBuilt.wrap(poBuilt.segments);

      const ackDate = addDays(poBuilt.date, 1);
      const ackBuilt = buildAck855(new Random(options.seed + 2), {
        poNumber,
        lines,
        partner: options.partner,
        referenceDate: ackDate,
      });
      const ackDoc = ackBuilt.wrap(ackBuilt.segments);

      const shipDate = addDays(poBuilt.date, 5);
      const asnBuilt = buildAsn856(new Random(options.seed + 3), {
        poNumber,
        lines,
        partner: options.partner,
        referenceDate: shipDate,
      });
      const asnDoc = asnBuilt.wrap(asnBuilt.segments);

      const invoiceDate = addDays(shipDate, 1);
      const invoiceBuilt = buildInvoice810(new Random(options.seed + 4), {
        poNumber,
        poDate: poBuilt.date,
        lines,
        partner: options.partner,
        referenceDate: invoiceDate,
      });
      const invoiceDoc = invoiceBuilt.wrap(invoiceBuilt.segments);

      // The 997 acknowledges the 850: the seller's system confirming receipt of the PO, same day it arrives.
      const faBuilt = buildFa997(new Random(options.seed + 5), {
        target: targetFrom("850", poDoc.meta.controlNumbers),
        partner: options.partner,
        referenceDate: poBuilt.date,
      });
      const faDoc = faBuilt.wrap(faBuilt.segments);

      let bundle: ScenarioBundle = { po: poDoc, ack: ackDoc, asn: asnDoc, invoice: invoiceDoc, fa: faDoc };
      for (const fault of scenarioFaults) bundle = fault(bundle);

      return {
        po: serialize(bundle.po),
        ack: serialize(bundle.ack),
        asn: serialize(bundle.asn),
        invoice: serialize(bundle.invoice),
        fa: bundle.fa ? serialize(bundle.fa) : null,
      };
    },
  };

  return api;
}

export const scenario = { orderToInvoice };
