/** The three self-defining delimiters an X12 interchange declares in its ISA segment. */
export interface Separators {
  element: string; // default "*"
  segment: string; // default "~"
  sub: string; // component element separator, default ":"
}

/** A single X12 segment: `segment[0]` is the segment ID, the rest are its elements. */
export type Segment = string[];

/** Control numbers that must match across a segment pair (ISA/IEA, GS/GE, ST/SE) in a well-formed interchange. */
export interface ControlNumbers {
  isa: string;
  group: string;
  transaction: string;
}

export interface DocMeta {
  docType: string;
  controlNumbers: ControlNumbers;
  date: Date;
}

/** A full X12 interchange (ISA through IEA) prior to serialization. */
export interface EdiDocument {
  segments: Segment[];
  separators: Separators;
  meta: DocMeta;
}

/**
 * A pure transform applied to a document. Faults are just functions —
 * composable, individually testable, and safe to apply in any order because
 * none of them read or advance a PRNG.
 */
export type Fault = (doc: EdiDocument) => EdiDocument;

/** Deep-enough clone so faults can mutate freely without affecting the original document or sibling builds. */
export function cloneDocument(doc: EdiDocument): EdiDocument {
  return {
    segments: doc.segments.map((segment) => [...segment]),
    separators: { ...doc.separators },
    meta: { ...doc.meta, controlNumbers: { ...doc.meta.controlNumbers } },
  };
}

export function findSegment(doc: EdiDocument, id: string): Segment | undefined {
  return doc.segments.find((segment) => segment[0] === id);
}

export function findSegments(doc: EdiDocument, id: string): Segment[] {
  return doc.segments.filter((segment) => segment[0] === id);
}

/** Renders a document to the final EDI string, using its own declared separators. */
export function serialize(doc: EdiDocument): string {
  const { element, segment } = doc.separators;
  return doc.segments.map((seg) => seg.join(element) + segment).join("");
}
