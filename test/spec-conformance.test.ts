import { X12Interchange, X12Parser } from "node-x12";
import { describe, expect, it } from "vitest";
import { ack855, asn856, fa997, invoice810, po850, scenario } from "../src/index.js";

/**
 * Cross-checks every document type against an independent, external X12
 * parser (node-x12) so a spec mistake in this library's own hand-rolled
 * segment logic doesn't just validate itself. node-x12 is a dev dependency
 * only — it never ships to consumers of this package.
 */
function assertParsesCleanly(edi: string, expectedTransactionSetId: string) {
  const parser = new X12Parser(true);
  // This library never sends the multi-ISA-per-file documents that would
  // parse as a "fat" interchange, so a plain X12Interchange is always expected.
  const interchange = parser.parse(edi) as X12Interchange;
  expect(parser.diagnostics).toEqual([]);
  expect(interchange.functionalGroups).toHaveLength(1);
  const transaction = interchange.functionalGroups[0]!.transactions[0]!;
  expect(transaction.header.tag).toBe("ST");
  expect(transaction.header.elements[0]!.value).toBe(expectedTransactionSetId);
}

describe("spec conformance (via node-x12)", () => {
  it("850 parses cleanly", () => {
    assertParsesCleanly(po850({ seed: 42, lines: 4 }).build(), "850");
  });

  it("855 parses cleanly", () => {
    assertParsesCleanly(ack855({ seed: 42, lines: 4 }).build(), "855");
  });

  it("856 parses cleanly", () => {
    assertParsesCleanly(asn856({ seed: 42, lines: 4 }).build(), "856");
  });

  it("810 parses cleanly", () => {
    assertParsesCleanly(invoice810({ seed: 42, lines: 4 }).build(), "810");
  });

  it("997 parses cleanly", () => {
    const target = {
      functionalIdCode: "PO",
      groupControlNumber: "123456",
      transactionSetId: "850",
      transactionSetControlNumber: "0001",
    };
    assertParsesCleanly(fa997({ seed: 42, target }).build(), "997");
  });

  it("every document in an orderToInvoice scenario parses cleanly", () => {
    const flow = scenario.orderToInvoice({ seed: 7, lines: 3 }).build();
    assertParsesCleanly(flow.po, "850");
    assertParsesCleanly(flow.ack, "855");
    assertParsesCleanly(flow.asn, "856");
    assertParsesCleanly(flow.invoice, "810");
    assertParsesCleanly(flow.fa!, "997");
  });
});
