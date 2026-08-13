# Design

## Why deterministic

Fixtures belong in snapshot tests and CI. Both are poisoned by non-determinism:
a flaky snapshot that changes on every run because a date or a random ID
shifted underneath it teaches a team to stop trusting (and eventually stop
reading) its own test failures.

So every document in this library is derived from a `seed`, and nothing else:

- Random values (quantities, prices, part numbers, control numbers) come from
  [Mulberry32](https://github.com/bryc/code/blob/master/jshash/PRNGs.md), a
  small seeded PRNG (`src/random.ts`). Never `Math.random()`.
- Dates come from a fixed epoch (`2024-01-01`) plus a seed-derived offset
  (`src/dates.ts`), never from `Date.now()` or `new Date()` with no arguments.

The result: `po850({ seed: 42 }).build()` returns the exact same string today,
a year from now, and on every CI runner in between — no matter when the test
suite happens to run. That's the property that makes it safe to commit a
generated document's snapshot to a test suite at all.

A corollary: a builder's `.build()` re-runs its whole generation function from
scratch (re-seeding its own PRNG) rather than mutating shared state, so calling
`.build()` twice on the same builder is also safe and idempotent — see
`src/builder.ts`.

Faults, in turn, are required to be pure, seed-free functions
(`EdiDocument -> EdiDocument` or, for scenario-level faults,
`ScenarioBundle -> ScenarioBundle`). None of them touch a PRNG. That's what
lets them compose freely and in any order via `.with(...)` without changing
what "the same seed" means.

## Why zero runtime dependencies

This library's only job is to produce strings. Pulling in a parser, a
templating engine, or a date library to do that would mean every consumer
inherits that dependency's install size, its security surface, and its
breaking changes — for a package whose entire contract is "call a function,
get a string back." Zero runtime dependencies also means it runs unmodified
in Node, Bun, Deno, and the browser.

The one dependency that *does* appear is `node-x12`, and it's a `devDependency`
used only in `test/spec-conformance.test.ts` to cross-check this library's
own hand-rolled segment logic against an independent parser. It never ships
to consumers — see `package.json`'s `files` field.

## Architecture

```
seed --> Random (PRNG) --> business segments --> envelope (ISA..IEA) --> EdiDocument
                                                                              |
                                                                        faults (pure)
                                                                              |
                                                                          serialize()
                                                                              |
                                                                          EDI string
```

- **`src/model.ts`** — the `EdiDocument` shape (an array of segments plus its
  own separators and a small `meta` block) and `serialize()`, which is the
  only place that turns segments back into a string.
- **`src/envelope.ts`** — builds ISA/GS/ST and SE/GE/IEA around a set of
  business segments, with consistent control numbers and a fixed-width ISA.
- **`src/documents/*.ts`** — one file per document type. Each exports an
  internal `build*()` function (segments + metadata, no envelope-wrapping
  decision made yet) and a public builder (`po850()`, etc.) that wraps it for
  standalone use. `scenario.ts` calls the internal functions directly so it
  can hand every document the *same* line items and PO number.
- **`src/faults/*.ts`** — one file per fault category. Document-level faults
  are `(doc) => doc'`; the faults that only make sense across documents
  (`fa997Missing`, `asnQtyMismatch`, ...) are `(bundle) => bundle'` and only
  work with `scenario.orderToInvoice(...).with(...)`.
- **`src/scenario.ts`** — generates one canonical set of order lines and a PO
  number, then builds all five documents from them with dates that move
  forward (PO → ACK +1d → ASN +5d → Invoice +1d) and a 997 whose AK1/AK2
  correctly reference the PO's own control numbers.

## What "spec-conformant" means here

The X12 004010 segment layouts in this library are representative, not a
certified implementation guide for any specific trading partner — that's the
whole reason `definePartner()` exists instead of a library of partner-specific
guides (see the README's Non-goals). `test/spec-conformance.test.ts` parses
every generated document with an independent parser (`node-x12`) to catch
structural mistakes (bad segment order, malformed ISA, wrong control number
wiring) — it doesn't certify EDI-guide compliance for any real trading
partner.
