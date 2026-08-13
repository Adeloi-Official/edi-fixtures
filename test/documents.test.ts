import { describe, expect, it } from "vitest";
import { po850, ack855, asn856, invoice810, fa997 } from "../src/index.js";
import { findSegment, findSegments, segmentsOf } from "./helpers.js";

describe("po850", () => {
  it("is deterministic: same seed produces byte-identical output", () => {
    const a = po850({ seed: 42, lines: 5 }).build();
    const b = po850({ seed: 42, lines: 5 }).build();
    expect(a).toBe(b);
  });

  it("is deterministic across multiple build() calls on the same builder", () => {
    const builder = po850({ seed: 1 });
    expect(builder.build()).toBe(builder.build());
  });

  it("produces a different document for a different seed", () => {
    const a = po850({ seed: 1 }).build();
    const b = po850({ seed: 2 }).build();
    expect(a).not.toBe(b);
  });

  it("has a fixed-width 106-character ISA segment", () => {
    const doc = po850({ seed: 42 }).build();
    const isaSegment = doc.split("~")[0] + "~";
    expect(isaSegment.length).toBe(106);
  });

  it("has consistent control numbers: ISA13=IEA02, GS06=GE02, ST02=SE02", () => {
    const doc = po850({ seed: 7, lines: 4 }).build();
    const isa = findSegment(doc, "ISA")!;
    const iea = findSegment(doc, "IEA")!;
    const gs = findSegment(doc, "GS")!;
    const ge = findSegment(doc, "GE")!;
    const st = findSegment(doc, "ST")!;
    const se = findSegment(doc, "SE")!;
    expect(isa[13]).toBe(iea[2]);
    expect(gs[6]).toBe(ge[2]);
    expect(st[2]).toBe(se[2]);
  });

  it("SE01 matches the actual segment count between ST and SE, inclusive", () => {
    const doc = po850({ seed: 7, lines: 4 }).build();
    const segments = segmentsOf(doc);
    const stIndex = segments.findIndex((s) => s[0] === "ST");
    const seIndex = segments.findIndex((s) => s[0] === "SE");
    const se = segments[seIndex]!;
    expect(Number(se[1])).toBe(seIndex - stIndex + 1);
  });

  it("emits one PO1/PID pair per requested line, and CTT matches the line count", () => {
    const doc = po850({ seed: 3, lines: 6 }).build();
    expect(findSegments(doc, "PO1")).toHaveLength(6);
    expect(findSegments(doc, "PID")).toHaveLength(6);
    expect(findSegment(doc, "CTT")![1]).toBe("6");
  });

  it("never repeats a PID description across lines, as long as line count doesn't exceed the description pool", () => {
    const doc = po850({ seed: 42, lines: 6 }).build();
    const descriptions = findSegments(doc, "PID").map((pid) => pid[5]);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("respects an explicit poNumber", () => {
    const doc = po850({ seed: 1, poNumber: "PO999999" }).build();
    expect(findSegment(doc, "BEG")![3]).toBe("PO999999");
  });

  it("matches its snapshot", () => {
    expect(po850({ seed: 42, lines: 2 }).build()).toMatchSnapshot();
  });
});

describe("ack855", () => {
  it("is deterministic and snapshot-stable", () => {
    expect(ack855({ seed: 42, lines: 2 }).build()).toBe(ack855({ seed: 42, lines: 2 }).build());
    expect(ack855({ seed: 42, lines: 2 }).build()).toMatchSnapshot();
  });

  it("acknowledges the same PO number it's given", () => {
    const doc = ack855({ seed: 1, poNumber: "PO123456" }).build();
    expect(findSegment(doc, "BAK")![3]).toBe("PO123456");
  });
});

describe("asn856", () => {
  it("is deterministic and snapshot-stable", () => {
    expect(asn856({ seed: 42, lines: 2 }).build()).toBe(asn856({ seed: 42, lines: 2 }).build());
    expect(asn856({ seed: 42, lines: 2 }).build()).toMatchSnapshot();
  });

  it("builds a well-formed HL hierarchy: Shipment -> Order -> Pack -> one Item per line", () => {
    const doc = asn856({ seed: 5, lines: 3 }).build();
    const hls = findSegments(doc, "HL");
    expect(hls).toHaveLength(6); // S, O, P, + 3 Items
    expect(hls[0]).toEqual(["HL", "1", "", "S"]);
    expect(hls[1]).toEqual(["HL", "2", "1", "O"]);
    expect(hls[2]).toEqual(["HL", "3", "2", "P"]);
    for (const itemHl of hls.slice(3)) {
      expect(itemHl[3]).toBe("I");
      expect(itemHl[2]).toBe("3"); // every item's parent is the Pack HL
    }
  });

  it("emits an 18-digit SSCC in the MAN segment", () => {
    const doc = asn856({ seed: 9 }).build();
    const man = findSegment(doc, "MAN")!;
    expect(man[1]).toBe("GM");
    expect(man[2]).toMatch(/^\d{18}$/);
  });
});

describe("invoice810", () => {
  it("is deterministic and snapshot-stable", () => {
    expect(invoice810({ seed: 42, lines: 2 }).build()).toBe(invoice810({ seed: 42, lines: 2 }).build());
    expect(invoice810({ seed: 42, lines: 2 }).build()).toMatchSnapshot();
  });

  it("references the PO number it was given", () => {
    const doc = invoice810({ seed: 1, poNumber: "PO555555" }).build();
    expect(findSegment(doc, "BIG")![4]).toBe("PO555555");
  });
});

describe("fa997", () => {
  const target = {
    functionalIdCode: "PO",
    groupControlNumber: "123456",
    transactionSetId: "850",
    transactionSetControlNumber: "0001",
  };

  it("is deterministic and snapshot-stable", () => {
    expect(fa997({ seed: 42, target }).build()).toBe(fa997({ seed: 42, target }).build());
    expect(fa997({ seed: 42, target }).build()).toMatchSnapshot();
  });

  it("acknowledges the given target's control numbers via AK1/AK2", () => {
    const doc = fa997({ seed: 1, target }).build();
    const ak1 = findSegment(doc, "AK1")!;
    const ak2 = findSegment(doc, "AK2")!;
    expect(ak1).toEqual(["AK1", "PO", "123456"]);
    expect(ak2).toEqual(["AK2", "850", "0001"]);
  });
});
