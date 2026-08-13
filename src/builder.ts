import { recomputeSegmentCount, serialize, type EdiDocument, type Fault } from "./model.js";

export interface DocBuilder {
  /** Queues a fault to apply, in order, after the base document is generated. Returns `this` for chaining. */
  with(fault: Fault): DocBuilder;
  /** Serializes the final ISA...IEA string. */
  build(): string;
  /** The document model before serialization — useful for assertions in tests. */
  buildDocument(): EdiDocument;
}

/**
 * Wraps a `generate` function into the chainable `.with(fault).build()` API.
 *
 * `generate` is called fresh on every `build()`/`buildDocument()` call (not
 * memoized), so a builder is safe to build multiple times and always
 * produces the same output for the same seed — see docs/design.md.
 */
export function createBuilder(generate: () => EdiDocument): DocBuilder {
  const faults: Fault[] = [];
  const api: DocBuilder = {
    with(fault) {
      faults.push(fault);
      return api;
    },
    buildDocument() {
      let doc = generate();
      for (const fault of faults) doc = fault(doc);
      return recomputeSegmentCount(doc);
    },
    build() {
      return serialize(api.buildDocument());
    },
  };
  return api;
}
