# edi-fixtures

Realistic X12 test documents for integration testing — including the ways
they break in production.

Real EDI files are confidential. Spec examples are sterile: one line item,
round numbers, every segment present. This library generates deterministic,
realistic 850/855/856/810/997 documents — and lets you inject the 18 failure
modes we keep seeing in real trading-partner relationships: nonstandard
UOMs, missing partner-required REFs, duplicate control numbers, orphaned HL
loops, 997s that never arrive.

Built by [Adeloi](https://adeloi.com), an engineering partner for industrial
suppliers and manufacturers.

[![CI](https://github.com/Adeloi-Official/edi-fixtures/actions/workflows/ci.yml/badge.svg)](https://github.com/Adeloi-Official/edi-fixtures/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40adeloi%2Fedi-fixtures)](https://www.npmjs.com/package/@adeloi/edi-fixtures)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

**Status: Stable. Feature-complete for the 004010 order-to-invoice flow.**

---

### See it in action

```ts
po850({ seed: 42, lines: 2 }).build();
```

```
ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *240404*0538*U*00401*530335606*0*P*:~
GS*PO*SENDERID*RECEIVERID*20240404*0518*27124*X*004010~
ST*850*0001~
BEG*00*NE*PO173006**20240404~
REF*DP*809~
DTM*002*20240412~
N1*ST*Vantage Supply Co*92*LOC4005~
N3*6007 Industrial Pkwy~
N4*Ontario*CA*91761~
PO1*1*228*EA*220.64*PE*BP*AX-31566~
PID*F****Hex Bolt 3/8-16 x 2in Zinc~
PO1*2*5*CS*209.50*PE*BP*SKU-50201~
PID*F****Shop Towel Roll Blue~
CTT*2~
SE*13*0001~
GE*1*27124~
IEA*1*530335606~
```

Now the same seed with two faults from the catalog applied:

```ts
po850({ seed: 42, lines: 2 })
  .with(faults.uomNonstandard())
  .with(faults.missingRef("DP"))
  .build();
```

```diff
 ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *240404*0538*U*00401*530335606*0*P*:~
 GS*PO*SENDERID*RECEIVERID*20240404*0518*27124*X*004010~
 ST*850*0001~
 BEG*00*NE*PO173006**20240404~
-REF*DP*809~
 DTM*002*20240412~
 N1*ST*Vantage Supply Co*92*LOC4005~
 N3*6007 Industrial Pkwy~
 N4*Ontario*CA*91761~
-PO1*1*228*EA*220.64*PE*BP*AX-31566~
+PO1*1*228*EACH*220.64*PE*BP*AX-31566~
 PID*F****Hex Bolt 3/8-16 x 2in Zinc~
-PO1*2*5*CS*209.50*PE*BP*SKU-50201~
+PO1*2*5*CASE*209.50*PE*BP*SKU-50201~
 PID*F****Shop Towel Roll Blue~
 CTT*2~
-SE*13*0001~
+SE*12*0001~
 GE*1*27124~
 IEA*1*530335606~
```

Same envelope, same control numbers, same line data — just the department
REF gone (and SE01 correctly recounted to 12, not left stale at 13 — removing
a segment is only ever *that* fault, never an accidental second one) and two
UOM codes swapped for the nonstandard synonyms partners actually send.
That's the whole idea: a document that's wrong in one specific, realistic
way instead of unrecognizable.

## Contents

- [Install](#install)
- [Quickstart](#quickstart)
- [What this is](#what-this-is)
- [What this is NOT](#what-this-is-not)
- [Document types](#document-types)
- [The fault catalog](#the-fault-catalog)
- [API](#api)
- [Contributing](#contributing)
- [License](#license)

## Install

```sh
npm install --save-dev @adeloi/edi-fixtures
```

Zero runtime dependencies. Works in Node ≥20, Bun, Deno, and the browser —
it's pure string generation in, string out.

## Quickstart

```ts
import { po850, scenario, faults, definePartner } from "@adeloi/edi-fixtures";

// 1. A valid document, deterministic — same seed, byte-identical output, forever.
const doc = po850({ seed: 42, lines: 5 }).build();

// 2. A deliberately broken document — the core of this library.
const broken = po850({ seed: 42 })
  .with(faults.uomNonstandard())   // "EACH" instead of "EA" in PO1-03
  .with(faults.missingRef("DP"))   // a partner-required REF is missing
  .build();

// 3. A consistent chain of documents across an order-to-invoice flow.
const flow = scenario.orderToInvoice({ seed: 7, lines: 3 }).build();
// -> { po, ack, asn, invoice, fa }
// Same PO number and line items end to end; each doc keeps its own
// interchange control numbers, exactly as five real transmissions would.

// 4. A chain with a realistic production fault injected.
const messy = scenario
  .orderToInvoice({ seed: 7 })
  .with(faults.asnQtyMismatch())   // the 856 reports more than the 850 ordered
  .with(faults.fa997Missing())     // and the 997 never arrives
  .build();

// 5. Parametrize for a trading partner, without pretending to be their real implementation guide.
const partner = definePartner({
  isaQualifier: "ZZ",
  requiredRefs: ["DP", "IA"],
  uomWhitelist: ["EA", "CS"],
});
const forPartner = po850({ seed: 1, partner }).build();
```

## What this is

Deterministic, realistic X12 test documents for integration testing — plus a
curated catalog of the failures that actually show up in real
trading-partner relationships, each one composable onto an otherwise-valid
document.

- **Deterministic.** Same seed → byte-identical document, today and five
  years from now. Fixtures belong in snapshot tests and CI, and
  non-determinism there is poison. Seeded PRNG, not `Math.random()`; dates
  derived from the seed, not the system clock. See [`docs/design.md`](./docs/design.md).
- **Realistic.** Plausible part numbers, mixed UOMs, crooked quantities and
  prices, a correct fixed-width ISA envelope, consistent control numbers
  across ISA/GS/ST/SE/GE/IEA, valid GS1 SSCC-18 check digits.
- **Fault injection.** Every fault in the catalog is a pure, composable
  function applied on top of an otherwise-valid document.
- **Scenario presets.** `scenario.orderToInvoice(...)` produces a consistent
  document chain — same PO number, same line items — across the full
  order-to-invoice flow.
- **Zero dependencies.** Pure strings in, pure strings out. No parser
  lock-in, no framework assumptions.

## What this is NOT

- **Not a parser or validator.** This library only generates documents. To
  diagnose X12 that is already wrong — including every fault in the catalog
  below — see [`x12-doctor`](https://github.com/Adeloi-Official/x12-doctor),
  the sister project this one is tested against. For general parsing, see
  [node-x12](https://github.com/aaronhuggins/node-x12) or the
  [Stedi](https://www.stedi.com/) EDI ecosystem.
- **Not a mapper or translator.**
- **Not a source of trading-partner implementation guides.** Guides for
  specific partners (Walmart, Grainger, etc.) are proprietary. `definePartner()`
  gives you a generic, configurable partner profile instead.
- **Not EDIFACT, TRADACOMS, or HIPAA transactions** (270/271/837/...).
- **Not an AS2/SFTP/VAN transport client.**
- **Not a UI.**

## Document types

X12 Release 004010 — the de facto standard in US retail/industrial EDI.

| Type | Name | Role in the flow |
|---|---|---|
| 850 | Purchase Order | Buyer places an order |
| 855 | PO Acknowledgment | Seller confirms/changes it |
| 856 | Advance Ship Notice | Shipment notice, with a full HL hierarchy (Shipment → Order → Pack → Item) |
| 810 | Invoice | Seller bills for it |
| 997 | Functional Acknowledgment | Receipt confirmation at the functional-group level |

Together these cover the complete **order-to-invoice flow** of a
distributor or manufacturer. 860/865 (Change Orders) are on the roadmap, not
in v1.0.

## The fault catalog

18 faults across 4 categories. Each one exists as code (`faults.*`), as a
documented entry in [`docs/faults.md`](./docs/faults.md) — what happens, why
it happens in production, and what it costs — and as a test case.

| Category | Faults |
|---|---|
| **A — Structure/Envelope** | `isaTruncated` · `seCountWrong` · `controlNumberMismatch` · `duplicateIsaControl` · `nonstandardSeparators` |
| **B — Semantics/Content** | `uomNonstandard` · `impliedDecimals` · `dateFormatShort` · `cttMismatch` · `missingRef` |
| **C — Sequence/Acknowledgment** | `fa997Missing` · `fa997Rejected` · `fa997UnknownGroup` · `outOfOrderInterchange` |
| **D — 856-specific** | `hlOrphan` · `ssccInvalid` · `asnQtyMismatch` · `asnAfterDelivery` |

Faults in categories A, B, and most of D operate on a single document via
`.with(...)`. Faults in category C, plus `asnQtyMismatch`, need more than one
document (or the absence of one) to mean anything, so they apply to a
`scenario.orderToInvoice(...)` chain instead. See
[`docs/faults.md`](./docs/faults.md) for the full writeup of each one.

### The other half

Each of these 18 faults maps to exactly one diagnosis in
[`x12-doctor`](https://github.com/Adeloi-Official/x12-doctor), which reads a
broken document and says what is wrong with it in plain English. The two
projects share one taxonomy: this library generates the broken document, that
one diagnoses it.

That correspondence is a contract, not a convention. x12-doctor's CI rebuilds
this library from source and regenerates its test corpus, so changing a fault
here fails the build there rather than silently degrading detection.

Useful together in a test: generate a document broken one specific way, then
assert your pipeline notices.

```ts
const broken = po850({ seed: 42 }).with(faults.uomNonstandard()).build();
```

```sh
x12doctor check broken.edi   # → B01, nonstandard unit of measure
```

## API

```ts
po850(options): DocBuilder
ack855(options): DocBuilder
asn856(options): DocBuilder
invoice810(options): DocBuilder
fa997(options): DocBuilder    // options.target identifies what's being acknowledged

interface DocBuilder {
  with(fault: Fault): DocBuilder;   // composable, chainable
  build(): string;                  // the final ISA...IEA string
  buildDocument(): EdiDocument;     // pre-serialization model, for assertions
}

scenario.orderToInvoice(options): ScenarioBuilder
interface ScenarioBuilder {
  with(fault: ScenarioFault): ScenarioBuilder;
  build(): { po: string; ack: string; asn: string; invoice: string; fa: string | null };
}

definePartner(overrides: Partial<PartnerProfile>): PartnerProfile
```

Every document builder shares an options shape along the lines of:

```ts
interface DocOptions {
  seed: number;
  lines?: number;          // default 3
  poNumber?: string;       // auto-generated from the seed if omitted
  partner?: PartnerProfile;
  referenceDate?: Date;
}
```

See [`docs/design.md`](./docs/design.md) for the determinism guarantees and
why this library has zero runtime dependencies.

## Contributing

Issues and PRs welcome — especially new faults backed by something you've
actually seen in production. Run `npm test` before opening a PR; every
document type and every fault has test coverage, including a cross-check
against an independent X12 parser (`node-x12`, dev-only) in
`test/spec-conformance.test.ts`.

## License

[Apache License 2.0](./LICENSE). Copyright 2026 Olevis LLC.
