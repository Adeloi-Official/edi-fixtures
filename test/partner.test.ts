import { describe, expect, it } from "vitest";
import { ack855, definePartner, invoice810, po850 } from "../src/index.js";
import { findSegment, findSegments } from "./helpers.js";

describe("PartnerProfile", () => {
  it("requiredRefs controls which REF segments a document actually carries", () => {
    const partner = definePartner({ requiredRefs: ["DP", "IA", "ST"] });
    const doc = po850({ seed: 1, partner }).build();
    const refQualifiers = findSegments(doc, "REF").map((r) => r[1]);
    expect(refQualifiers).toEqual(["DP", "IA", "ST"]);
  });

  it("defaults to a single REF*DP when requiredRefs isn't specified", () => {
    const doc = po850({ seed: 1 }).build();
    expect(findSegments(doc, "REF").map((r) => r[1])).toEqual(["DP"]);
  });

  it("applies requiredRefs on ack855 and invoice810 too", () => {
    const partner = definePartner({ requiredRefs: ["IA"] });
    expect(findSegments(ack855({ seed: 1, partner }).build(), "REF").map((r) => r[1])).toEqual(["IA"]);
    expect(findSegments(invoice810({ seed: 1, partner }).build(), "REF").map((r) => r[1])).toEqual(["IA"]);
  });

  it("uomWhitelist restricts every generated UOM code to the partner's allowed set", () => {
    const partner = definePartner({ uomWhitelist: ["CS"] });
    const doc = po850({ seed: 1, lines: 6, partner }).build();
    for (const po1 of findSegments(doc, "PO1")) {
      expect(po1[3]).toBe("CS");
    }
  });

  it("senderQualifier/receiverQualifier let ISA05 and ISA07 differ, falling back to isaQualifier when unset", () => {
    const partner = definePartner({ isaQualifier: "ZZ", senderQualifier: "ZZ", receiverQualifier: "01" });
    const isa = findSegment(po850({ seed: 1, partner }).build(), "ISA")!;
    expect(isa[5]).toBe("ZZ"); // ISA05
    expect(isa[7]).toBe("01"); // ISA07

    const fallback = findSegment(po850({ seed: 1, partner: definePartner({ isaQualifier: "ZZ" }) }).build(), "ISA")!;
    expect(fallback[5]).toBe("ZZ");
    expect(fallback[7]).toBe("ZZ");
  });

  it("keeps GS02/GS03 consistent with the (truncated) ISA06/ISA08 sender and receiver IDs", () => {
    const partner = definePartner({
      senderId: "SENDER-ID-LONGER-THAN-FIFTEEN-CHARS",
      receiverId: "RECEIVER-ID-ALSO-WAY-TOO-LONG",
    });
    const doc = po850({ seed: 1, partner }).build();
    const isa = findSegment(doc, "ISA")!;
    const gs = findSegment(doc, "GS")!;
    expect(isa[6]!.trim()).toBe(gs[2]); // ISA06 (space-padded to 15) vs GS02 (not padded)
    expect(isa[8]!.trim()).toBe(gs[3]); // ISA08 vs GS03
    expect(gs[2]!.length).toBeLessThanOrEqual(15);
    expect(gs[3]!.length).toBeLessThanOrEqual(15);
  });
});
