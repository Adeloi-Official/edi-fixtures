import type { X12Interchange } from "node-x12";

/** Splits a serialized document back into segments, for assertions that don't want to hand-parse strings. */
export function segmentsOf(edi: string, segmentTerminator = "~", elementSeparator = "*"): string[][] {
  return edi
    .split(segmentTerminator)
    .filter((s) => s.length > 0)
    .map((s) => s.split(elementSeparator));
}

export function findSegment(edi: string, tag: string): string[] | undefined {
  return segmentsOf(edi).find((s) => s[0] === tag);
}

export function findSegments(edi: string, tag: string): string[][] {
  return segmentsOf(edi).filter((s) => s[0] === tag);
}

export type ParsedInterchange = X12Interchange;
