import { describe, expect, it } from "vitest";
import { scenario } from "../src/index.js";
import { findSegment, findSegments } from "./helpers.js";

describe("scenario.orderToInvoice", () => {
  it("is deterministic: same seed produces byte-identical documents across the whole bundle", () => {
    const a = scenario.orderToInvoice({ seed: 7, lines: 3 }).build();
    const b = scenario.orderToInvoice({ seed: 7, lines: 3 }).build();
    expect(a).toEqual(b);
  });

  it("carries the same PO number through PO, ACK, ASN, and Invoice", () => {
    const flow = scenario.orderToInvoice({ seed: 7, lines: 3 }).build();
    const poNumber = findSegment(flow.po, "BEG")![3];
    expect(findSegment(flow.ack, "BAK")![3]).toBe(poNumber);
    expect(findSegment(flow.asn, "PRF")![1]).toBe(poNumber);
    expect(findSegment(flow.invoice, "BIG")![4]).toBe(poNumber);
  });

  it("carries the same per-line quantity, UOM, and part number through PO, ACK, ASN, and Invoice", () => {
    const flow = scenario.orderToInvoice({ seed: 7, lines: 3 }).build();
    const poLines = findSegments(flow.po, "PO1");
    const ackLines = findSegments(flow.ack, "PO1");
    const invLines = findSegments(flow.invoice, "IT1");
    const asnLines = findSegments(flow.asn, "SN1");
    const asnParts = findSegments(flow.asn, "LIN");

    for (let i = 0; i < poLines.length; i++) {
      const [, , qty, uom, price, , , partNumber] = poLines[i]!;
      expect(ackLines[i]!.slice(1)).toEqual(poLines[i]!.slice(1));
      expect(invLines[i]!.slice(1)).toEqual(poLines[i]!.slice(1));
      expect(asnLines[i]!.slice(2)).toEqual([qty, uom]);
      expect(asnParts[i]![3]).toBe(partNumber);
    }
  });

  it("each document keeps its own independent ISA/GS/ST control numbers, as five real transmissions would", () => {
    const flow = scenario.orderToInvoice({ seed: 7 }).build();
    const isaControls = [flow.po, flow.ack, flow.asn, flow.invoice, flow.fa!].map((doc) => findSegment(doc, "ISA")![13]);
    expect(new Set(isaControls).size).toBe(5);
  });

  it("the 997 acknowledges the PO's actual group and transaction control numbers", () => {
    const flow = scenario.orderToInvoice({ seed: 7 }).build();
    const poGs = findSegment(flow.po, "GS")!;
    const poSt = findSegment(flow.po, "ST")!;
    const ak1 = findSegment(flow.fa!, "AK1")!;
    const ak2 = findSegment(flow.fa!, "AK2")!;
    expect(ak1).toEqual(["AK1", "PO", poGs[6]]);
    expect(ak2).toEqual(["AK2", "850", poSt[2]]);
  });

  it("documents move forward in time: PO <= ACK <= ASN <= Invoice", () => {
    const flow = scenario.orderToInvoice({ seed: 7 }).build();
    const dateOf = (doc: string) => findSegment(doc, "GS")![4]!;
    expect(dateOf(flow.po) <= dateOf(flow.ack)).toBe(true);
    expect(dateOf(flow.ack) <= dateOf(flow.asn)).toBe(true);
    expect(dateOf(flow.asn) <= dateOf(flow.invoice)).toBe(true);
  });

  it("respects an explicit line count across every document", () => {
    const flow = scenario.orderToInvoice({ seed: 7, lines: 5 }).build();
    expect(findSegments(flow.po, "PO1")).toHaveLength(5);
    expect(findSegments(flow.ack, "PO1")).toHaveLength(5);
    expect(findSegments(flow.invoice, "IT1")).toHaveLength(5);
    expect(findSegments(flow.asn, "SN1")).toHaveLength(5);
  });
});
