import { describe, expect, it } from "vitest";
import { po850, asn856, faults, scenario } from "../src/index.js";
import { findSegment, findSegments, segmentsOf } from "./helpers.js";

describe("faults catalog", () => {
  it("exposes exactly the 18 documented faults", () => {
    expect(Object.keys(faults).sort()).toEqual(
      [
        "isaTruncated",
        "seCountWrong",
        "controlNumberMismatch",
        "duplicateIsaControl",
        "nonstandardSeparators",
        "uomNonstandard",
        "impliedDecimals",
        "dateFormatShort",
        "cttMismatch",
        "missingRef",
        "fa997Missing",
        "fa997Rejected",
        "fa997UnknownGroup",
        "outOfOrderInterchange",
        "hlOrphan",
        "ssccInvalid",
        "asnQtyMismatch",
        "asnAfterDelivery",
      ].sort(),
    );
  });
});

describe("category A — structure/envelope", () => {
  it("isaTruncated breaks the fixed 106-character ISA width", () => {
    const doc = po850({ seed: 1 }).with(faults.isaTruncated()).build();
    const isaSegment = doc.split("~")[0] + "~";
    expect(isaSegment.length).not.toBe(106);
  });

  it("seCountWrong makes SE01 disagree with the real segment count", () => {
    const clean = po850({ seed: 1, lines: 3 }).build();
    const broken = po850({ seed: 1, lines: 3 }).with(faults.seCountWrong()).build();
    expect(findSegment(broken, "SE")![1]).not.toBe(findSegment(clean, "SE")![1]);
  });

  it("controlNumberMismatch makes ST02 != SE02", () => {
    const doc = po850({ seed: 1 }).with(faults.controlNumberMismatch()).build();
    expect(findSegment(doc, "ST")![2]).not.toBe(findSegment(doc, "SE")![2]);
  });

  it("duplicateIsaControl forces a fixed, repeatable control number across independent documents", () => {
    const a = po850({ seed: 1 }).with(faults.duplicateIsaControl()).build();
    const b = po850({ seed: 2 }).with(faults.duplicateIsaControl()).build();
    expect(findSegment(a, "ISA")![13]).toBe(findSegment(b, "ISA")![13]);
    expect(findSegment(a, "ISA")![13]).toBe(findSegment(a, "IEA")![2]);
  });

  it("nonstandardSeparators swaps the element and segment delimiters", () => {
    const doc = po850({ seed: 1 }).with(faults.nonstandardSeparators("|", ">")).build();
    expect(doc).toContain("|");
    expect(doc).toContain(">");
    expect(doc).not.toContain("~");
  });
});

describe("category B — semantics/content", () => {
  it("uomNonstandard replaces standard UOM codes with the nonstandard synonyms partners actually send", () => {
    const doc = po850({ seed: 1, lines: 3 }).with(faults.uomNonstandard()).build();
    for (const po1 of findSegments(doc, "PO1")) {
      expect(["EA", "CS", "BX", "FT"]).not.toContain(po1[3]);
    }
  });

  it("impliedDecimals strips the decimal point from line prices", () => {
    const clean = po850({ seed: 1, lines: 1 }).build();
    const broken = po850({ seed: 1, lines: 1 }).with(faults.impliedDecimals()).build();
    const cleanPrice = findSegment(clean, "PO1")![4]!;
    const brokenPrice = findSegment(broken, "PO1")![4]!;
    expect(brokenPrice).not.toContain(".");
    expect(Number(brokenPrice)).toBe(Math.round(Number(cleanPrice) * 100));
  });

  it("dateFormatShort drops the century from DTM dates", () => {
    const doc = po850({ seed: 1 }).with(faults.dateFormatShort()).build();
    for (const dtm of findSegments(doc, "DTM")) {
      expect(dtm[2]).toHaveLength(6);
    }
  });

  it("cttMismatch changes the CTT count away from the real line count", () => {
    const clean = po850({ seed: 1, lines: 3 }).build();
    const broken = po850({ seed: 1, lines: 3 }).with(faults.cttMismatch()).build();
    expect(findSegment(broken, "CTT")![1]).not.toBe(findSegment(clean, "CTT")![1]);
  });

  it("missingRef removes a REF segment with the given qualifier", () => {
    const clean = po850({ seed: 1 }).build();
    const broken = po850({ seed: 1 }).with(faults.missingRef("DP")).build();
    expect(findSegments(clean, "REF").some((r) => r[1] === "DP")).toBe(true);
    expect(findSegments(broken, "REF").some((r) => r[1] === "DP")).toBe(false);
  });
});

describe("category D — 856-specific document faults", () => {
  it("hlOrphan points every Item HL at a Pack parent that doesn't exist", () => {
    const doc = asn856({ seed: 1, lines: 2 }).with(faults.hlOrphan()).build();
    const hls = findSegments(doc, "HL");
    const realParentIds = new Set(hls.map((hl) => hl[1]));
    for (const hl of hls.filter((h) => h[3] === "I")) {
      expect(realParentIds.has(hl[2]!)).toBe(false);
    }
  });

  it("ssccInvalid flips the SSCC-18 check digit so it no longer validates", () => {
    const clean = asn856({ seed: 1 }).build();
    const broken = asn856({ seed: 1 }).with(faults.ssccInvalid()).build();
    expect(findSegment(broken, "MAN")![2]).not.toBe(findSegment(clean, "MAN")![2]);
    expect(findSegment(broken, "MAN")![2]).toMatch(/^\d{18}$/);
  });

  it("asnAfterDelivery dates the ASN after its own declared delivery date", () => {
    const doc = asn856({ seed: 1 }).with(faults.asnAfterDelivery()).build();
    const bsnDate = findSegment(doc, "BSN")![3]!;
    const deliveryDate = segmentsOf(doc).find((s) => s[0] === "DTM" && s[1] === "017")![2]!;
    expect(bsnDate > deliveryDate).toBe(true);
  });

  it("asnAfterDelivery is independent of the host machine's timezone", () => {
    // Regression test: an earlier implementation parsed the delivery date with
    // `new Date(y, m, d)` (local time) and re-formatted it with UTC getters —
    // correct only by accident in UTC-based CI, and silently wrong (off by a
    // day) on a machine east of UTC. This must produce the same output no
    // matter what TZ the process runs under, or determinism is broken.
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const utcResult = asn856({ seed: 1 }).with(faults.asnAfterDelivery()).build();

      process.env.TZ = "Pacific/Kiritimati"; // UTC+14 — the most extreme zone that exists
      const farEastResult = asn856({ seed: 1 }).with(faults.asnAfterDelivery()).build();

      process.env.TZ = "Etc/GMT+12"; // UTC-12 — the most extreme negative offset
      const farWestResult = asn856({ seed: 1 }).with(faults.asnAfterDelivery()).build();

      expect(farEastResult).toBe(utcResult);
      expect(farWestResult).toBe(utcResult);
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });

  it("asnAfterDelivery is a no-op when composed after a fault that's already reshaped the DTM date", () => {
    // Regression test: dateFormatShort() shortens DTM*017 from 8-char CCYYMMDD to
    // 6-char YYMMDD. asnAfterDelivery() must recognize it can no longer trust the
    // date's shape and skip, rather than slicing garbage into a nonsense date —
    // faults are documented as safe to compose in any order.
    const clean = asn856({ seed: 1 }).with(faults.dateFormatShort()).build();
    const composed = asn856({ seed: 1 }).with(faults.dateFormatShort()).with(faults.asnAfterDelivery()).build();
    expect(composed).toBe(clean);
  });
});

describe("category C and cross-document — sequence/acknowledgment (scenario-level)", () => {
  it("fa997Missing removes the 997 from the bundle", () => {
    const flow = scenario.orderToInvoice({ seed: 1 }).with(faults.fa997Missing()).build();
    expect(flow.fa).toBeNull();
  });

  it("fa997Rejected flips AK5/AK9 to R", () => {
    const flow = scenario.orderToInvoice({ seed: 1 }).with(faults.fa997Rejected()).build();
    expect(findSegment(flow.fa!, "AK5")![1]).toBe("R");
  });

  it("fa997UnknownGroup makes AK1's group control number reference a group that was never sent", () => {
    const clean = scenario.orderToInvoice({ seed: 1 }).build();
    const broken = scenario.orderToInvoice({ seed: 1 }).with(faults.fa997UnknownGroup()).build();
    const sentGroupControl = findSegment(clean.po, "GS")![6]!;
    expect(findSegment(broken.fa!, "AK1")![2]).not.toBe(sentGroupControl);
  });

  it("outOfOrderInterchange swaps ISA timestamps between the ASN and its ACK", () => {
    const clean = scenario.orderToInvoice({ seed: 1 }).build();
    const broken = scenario.orderToInvoice({ seed: 1 }).with(faults.outOfOrderInterchange()).build();
    expect(findSegment(broken.asn, "ISA")![9]).toBe(findSegment(clean.ack, "ISA")![9]);
    expect(findSegment(broken.ack, "ISA")![9]).toBe(findSegment(clean.asn, "ISA")![9]);
  });

  it("asnQtyMismatch increases the ASN's first shipped quantity beyond what the PO ordered", () => {
    const flow = scenario.orderToInvoice({ seed: 1, lines: 2 }).with(faults.asnQtyMismatch(7)).build();
    const orderedQty = Number(findSegment(flow.po, "PO1")![2]);
    const shippedQty = Number(findSegment(flow.asn, "SN1")![2]);
    expect(shippedQty).toBe(orderedQty + 7);
  });

  it("faults compose: multiple faults on one document all apply", () => {
    const doc = po850({ seed: 1 })
      .with(faults.uomNonstandard())
      .with(faults.missingRef("DP"))
      .with(faults.cttMismatch(2))
      .build();
    expect(findSegments(doc, "REF").some((r) => r[1] === "DP")).toBe(false);
    expect(["EA", "CS", "BX", "FT"]).not.toContain(findSegment(doc, "PO1")![3]);
  });
});
