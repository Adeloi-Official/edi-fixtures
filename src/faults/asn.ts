import { addDays, formatDateCCYYMMDD } from "../dates.js";
import { appendGs1CheckDigit } from "../gs1.js";
import { cloneDocument, findSegment, type Fault } from "../model.js";
import type { ScenarioBundle, ScenarioFault } from "../scenario.js";

/**
 * Category D — 856-specific faults. Chargeback territory: these are the
 * ASN bugs that cost real money because they're discovered at the dock,
 * not in a test suite.
 */

/** An Item HL references a Pack HL parent that doesn't exist in this interchange. */
export function hlOrphan(): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    for (const seg of d.segments) {
      if (seg[0] === "HL" && seg[3] === "I") {
        seg[2] = "9999"; // parent HL ID that was never sent
      }
    }
    return d;
  };
}

/** Flips the GS1 mod-10 check digit on the MAN segment's SSCC-18, so the license plate barcode won't scan clean. */
export function ssccInvalid(): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    const man = findSegment(d, "MAN");
    if (man && man[2] && man[2].length === 18) {
      const corrected = appendGs1CheckDigit(man[2].slice(0, 17));
      const brokenCheckDigit = String((Number(corrected.slice(-1)) + 1) % 10);
      man[2] = corrected.slice(0, 17) + brokenCheckDigit;
    }
    return d;
  };
}

/** The ASN itself is dated after the estimated delivery date it declares — the notice arrives after the goods should have. */
export function asnAfterDelivery(): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    const bsn = findSegment(d, "BSN");
    const deliveryDtm = d.segments.find((seg) => seg[0] === "DTM" && seg[1] === "017");
    if (bsn && bsn[3] && deliveryDtm && deliveryDtm[2]) {
      const deliveryDate = new Date(
        Number(deliveryDtm[2].slice(0, 4)),
        Number(deliveryDtm[2].slice(4, 6)) - 1,
        Number(deliveryDtm[2].slice(6, 8)),
      );
      const lateDate = addDays(deliveryDate, 5);
      bsn[3] = formatDateCCYYMMDD(lateDate);
    }
    return d;
  };
}

/**
 * The ASN reports more units shipped than the PO ordered, per line — the single most expensive
 * everyday fault: it's the one that generates an overbill or a receiving discrepancy at the DC.
 * Scenario-level because it needs to compare against the PO that was actually sent.
 */
export function asnQtyMismatch(overage = 7): ScenarioFault {
  return (bundle: ScenarioBundle): ScenarioBundle => {
    const asn = cloneDocument(bundle.asn);
    let bumped = false;
    for (const seg of asn.segments) {
      if (seg[0] === "SN1" && seg[2] && !bumped) {
        seg[2] = String(Number(seg[2]) + overage);
        bumped = true; // only the first line, so the mismatch is easy to isolate in a test assertion
      }
    }
    return { ...bundle, asn };
  };
}
