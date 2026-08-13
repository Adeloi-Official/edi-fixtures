import { cloneDocument, type Fault } from "../model.js";

/**
 * Category B — Semantics / Content faults.
 *
 * The envelope is fine; the business content lies. These are the faults
 * that pass structural validation and still cause a chargeback.
 */

const DEFAULT_UOM_MAP: Record<string, string> = { EA: "EACH", CS: "CASE", BX: "BOX", FT: "FEET" };

/** "EACH"/"CASE" instead of the standard "EA"/"CS" in PO1-03 / IT1-03 / SN1-03. The single most common trading-partner bug. */
export function uomNonstandard(mapping: Record<string, string> = DEFAULT_UOM_MAP): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    for (const seg of d.segments) {
      if ((seg[0] === "PO1" || seg[0] === "IT1") && seg[3] && mapping[seg[3]]) {
        seg[3] = mapping[seg[3]] as string;
      }
      if (seg[0] === "SN1" && seg[3] && mapping[seg[3]]) {
        seg[3] = mapping[seg[3]] as string;
      }
    }
    return d;
  };
}

/** Unit price loses its decimal point — "10.50" becomes "1050", a 100x invoicing error if the receiver doesn't re-apply it. */
export function impliedDecimals(): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    for (const seg of d.segments) {
      if ((seg[0] === "PO1" || seg[0] === "IT1") && seg[4]) {
        seg[4] = String(Math.round(Number(seg[4]) * 100));
      }
    }
    return d;
  };
}

/** DTM dates shortened from CCYYMMDD to YYMMDD — the century silently disappears. */
export function dateFormatShort(): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    for (const seg of d.segments) {
      if (seg[0] === "DTM" && seg[2] && seg[2].length === 8) {
        seg[2] = seg[2].slice(2);
      }
    }
    return d;
  };
}

/** CTT's line count no longer matches the actual number of PO1/IT1 lines. */
export function cttMismatch(offset = 1): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    const ctt = d.segments.find((seg) => seg[0] === "CTT");
    if (ctt && ctt[1]) ctt[1] = String(Math.max(0, Number(ctt[1]) + offset));
    return d;
  };
}

/** Drops a REF segment with the given qualifier — e.g. a partner-required Department Number (`"DP"`). Missing it is a classic chargeback trigger. */
export function missingRef(qualifier: string): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    d.segments = d.segments.filter((seg) => !(seg[0] === "REF" && seg[1] === qualifier));
    return d;
  };
}
