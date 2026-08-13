import { padLeft } from "../format.js";
import { cloneDocument, findSegment, type Fault } from "../model.js";

/**
 * Category A — Structure / Envelope faults.
 *
 * These break the interchange itself, before a mapper ever looks at
 * business content: wrong fixed widths, mismatched control numbers,
 * replayed interchanges, non-standard delimiters.
 */

/** ISA is no longer exactly 106 characters — some mappers crash outright instead of rejecting cleanly. */
export function isaTruncated(): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    const isa = findSegment(d, "ISA");
    if (isa && isa[8]) isa[8] = isa[8].slice(0, -3); // ISA08 (Interchange Receiver ID) chopped short
    return d;
  };
}

/** SE01 (segment count) no longer matches the actual segment count — some translators silently ignore this. */
export function seCountWrong(offset = 1): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    const se = findSegment(d, "SE");
    if (se && se[1]) se[1] = String(Number(se[1]) + offset);
    return d;
  };
}

/** ST02 no longer equals SE02 — the document stalls in the receiver's queue. */
export function controlNumberMismatch(): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    const se = findSegment(d, "SE");
    if (se && se[2]) se[2] = padLeft(String(Number(se[2]) + 1), se[2].length);
    return d;
  };
}

/** Forces ISA13/IEA02 to a fixed control number — simulates a VAN retry or interchange replay. Pair two documents with this fault to test dedup. */
export function duplicateIsaControl(controlNumber = "000000001"): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    const isa = findSegment(d, "ISA");
    const iea = findSegment(d, "IEA");
    const padded = padLeft(controlNumber, 9);
    if (isa) isa[13] = padded;
    if (iea) iea[2] = padded;
    d.meta.controlNumbers = { ...d.meta.controlNumbers, isa: padded };
    return d;
  };
}

/** Partner uses `|` and `>` instead of the conventional `*` and `~`. Legal per X12 (delimiters are self-defining) — plenty of parsers assume the defaults anyway. */
export function nonstandardSeparators(element = "|", segment = ">"): Fault {
  return (doc) => {
    const d = cloneDocument(doc);
    d.separators = { ...d.separators, element, segment };
    return d;
  };
}
