import * as structure from "./structure.js";
import * as semantics from "./semantics.js";
import * as asnFaults from "./asn.js";
import * as sequence from "./sequence.js";

/**
 * The full fault catalog, callable as `faults.uomNonstandard()`, etc.
 *
 * - Category A/B and the 856-only part of Category D (`hlOrphan`, `ssccInvalid`,
 *   `asnAfterDelivery`) return a document-level `Fault`, usable with any single
 *   document builder's `.with(...)`.
 * - Category C and `asnQtyMismatch` return a `ScenarioFault`, usable only with
 *   `scenario.orderToInvoice(...).with(...)` since they need more than one
 *   document (or the absence of one) to make sense.
 *
 * See docs/faults.md for what each one means in production.
 */
export const faults = {
  ...structure,
  ...semantics,
  ...asnFaults,
  ...sequence,
};

export type { Fault } from "../model.js";
export type { ScenarioFault } from "../scenario.js";
