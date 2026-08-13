import { cloneDocument, findSegment } from "../model.js";
import type { ScenarioBundle, ScenarioFault } from "../scenario.js";

/**
 * Category C — Sequence / Acknowledgment faults.
 *
 * All scenario-level: these are about what arrives, what doesn't, and in
 * what order across a document flow — not about any single document's
 * internal structure.
 */

/** The 997 never arrives. The sender is left to assume delivery, or to resend and hope the receiver dedupes. */
export function fa997Missing(): ScenarioFault {
  return (bundle: ScenarioBundle): ScenarioBundle => ({ ...bundle, fa: null });
}

/** The 997 arrives with AK5 = "R" (Rejected) — the real question is whether anything downstream actually reads it. */
export function fa997Rejected(): ScenarioFault {
  return (bundle: ScenarioBundle): ScenarioBundle => {
    if (!bundle.fa) return bundle;
    const fa = cloneDocument(bundle.fa);
    const ak5 = findSegment(fa, "AK5");
    const ak9 = findSegment(fa, "AK9");
    if (ak5) ak5[1] = "R";
    if (ak9) ak9[1] = "R";
    return { ...bundle, fa };
  };
}

/** The 997's AK1 references a functional group control number that was never actually sent. */
export function fa997UnknownGroup(): ScenarioFault {
  return (bundle: ScenarioBundle): ScenarioBundle => {
    if (!bundle.fa) return bundle;
    const fa = cloneDocument(bundle.fa);
    const ak1 = findSegment(fa, "AK1");
    if (ak1 && ak1[2]) ak1[2] = String(Number(ak1[2]) + 999_000);
    return { ...bundle, fa };
  };
}

/** The ASN's interchange date/time is swapped with the ACK's, so the ship notice appears to have arrived before its own PO acknowledgment. */
export function outOfOrderInterchange(): ScenarioFault {
  return (bundle: ScenarioBundle): ScenarioBundle => {
    const asn = cloneDocument(bundle.asn);
    const ack = cloneDocument(bundle.ack);
    const asnIsa = findSegment(asn, "ISA");
    const ackIsa = findSegment(ack, "ISA");
    const asnGs = findSegment(asn, "GS");
    const ackGs = findSegment(ack, "GS");
    if (asnIsa && ackIsa) {
      const [asnDate, asnTime, ackDate, ackTime] = [asnIsa[9], asnIsa[10], ackIsa[9], ackIsa[10]];
      asnIsa[9] = ackDate as string;
      asnIsa[10] = ackTime as string;
      ackIsa[9] = asnDate as string;
      ackIsa[10] = asnTime as string;
    }
    if (asnGs && ackGs) {
      const [asnDate, asnTime, ackDate, ackTime] = [asnGs[4], asnGs[5], ackGs[4], ackGs[5]];
      asnGs[4] = ackDate as string;
      asnGs[5] = ackTime as string;
      ackGs[4] = asnDate as string;
      ackGs[5] = asnTime as string;
    }
    return { ...bundle, asn, ack };
  };
}
