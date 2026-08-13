# The fault catalog

Eighteen ways real X12 documents break in production, each available as a
composable fault: `faults.<name>()`. Every one of these is here because it's
a failure mode that actually shows up in trading-partner relationships — not
a theoretical edge case invented for coverage.

Document-level faults (categories A, B, and part of D) apply to a single
document via `.with(...)`:

```ts
import { po850, faults } from "@adeloi/edi-fixtures";

const broken = po850({ seed: 42 })
  .with(faults.uomNonstandard())
  .with(faults.missingRef("DP"))
  .build();
```

Scenario-level faults (category C, plus `asnQtyMismatch`) need more than one
document — or the absence of one — to mean anything, so they apply to a
`scenario.orderToInvoice(...)` chain instead:

```ts
import { scenario, faults } from "@adeloi/edi-fixtures";

const messy = scenario
  .orderToInvoice({ seed: 7 })
  .with(faults.asnQtyMismatch())
  .with(faults.fa997Missing())
  .build();
```

---

## Category A — Structure / Envelope

Faults that break the interchange itself, before any mapper looks at business
content.

### `isaTruncated()`

**What happens:** The ISA segment is no longer exactly 106 characters.

**Why it happens in production:** Someone hand-edits a fixed-width EDI file,
or a mapper writes a field a few characters short and nobody notices because
the file still "looks like EDI" at a glance.

**What it costs:** Depends entirely on the receiver. A strict mapper rejects
the interchange outright with a parse error. A lenient one silently
misaligns every field after the truncation point and processes garbage as if
it were valid — the worse outcome, because nothing alerts anyone until a
downstream report is wrong.

### `seCountWrong()`

**What happens:** SE01 (the transaction set's segment count) no longer
matches the number of segments actually between ST and SE.

**Why it happens in production:** A segment gets added or removed by a
mapping bug after the count was already computed.

**What it costs:** Some translators validate this strictly and reject the
transaction. Others don't check it at all — which means it's a landmine:
harmless until the one receiver that does validate it starts bouncing every
file from that trading partner.

### `controlNumberMismatch()`

**What happens:** ST02 no longer equals SE02.

**Why it happens in production:** Usually a mapper bug where the trailer is
built from a different counter than the header.

**What it costs:** The transaction set can't be reliably correlated between
its own header and trailer, so it stalls in the receiver's queue for manual
intervention — exactly the kind of thing that gets discovered a day later
when someone asks why an order never showed up in the ERP.

### `duplicateIsaControl(controlNumber?)`

**What happens:** Forces the ISA13/IEA02 control number to a fixed,
repeatable value, so two independently generated interchanges collide.

**Why it happens in production:** A VAN retries a delivery after a timeout
that wasn't really a failure, or a sender's system re-transmits after a
crash without realizing the first attempt succeeded.

**What it costs:** This is *the* interchange-replay/deduplication test case.
A receiver that doesn't track seen control numbers per sender will process
the same purchase order, ASN, or invoice twice — a duplicate shipment or a
duplicate payment.

### `nonstandardSeparators(element?, segment?)`

**What happens:** Swaps the default `*` element separator and `~` segment
terminator for different characters (`|` and `>` by default).

**Why it happens in production:** X12 delimiters are self-defining by
design — a partner is entitled to pick their own. Plenty of parsers were
written assuming the defaults anyway and choke the moment they see anything
else.

**What it costs:** A parser with defaults hardcoded either throws immediately
or, worse, silently parses everything as one giant garbled element.

---

## Category B — Semantics / Content

The envelope is fine; the content lies. These pass structural validation and
still cause a chargeback.

### `uomNonstandard(mapping?)`

**What happens:** Standard UOM codes (`EA`, `CS`, `BX`, `FT`) are replaced
with the nonstandard synonyms partners actually send (`EACH`, `CASE`, `BOX`,
`FEET`).

**Why it happens in production:** The partner's own ERP uses its internal
unit vocabulary and nobody normalized it before sending. This is, by a wide
margin, the most common real-world EDI content bug.

**What it costs:** A receiving system with a hardcoded UOM whitelist rejects
the line, or worse, silently defaults to `EA` and mis-prices or
mis-quantities the order.

### `impliedDecimals()`

**What happens:** Line prices lose their decimal point: `10.50` becomes
`1050`.

**Why it happens in production:** Some EDI conventions represent money with
implied decimals (cents-as-integer) and some don't; a mapper on one side of
the trading relationship applies the wrong assumption.

**What it costs:** A 100x pricing error, silently. This is a chargeback and
possibly a real accounting incident if it reaches an invoice before anyone
notices.

### `dateFormatShort()`

**What happens:** DTM dates lose their century: `20240115` becomes `240115`.

**Why it happens in production:** A field originally built for ISA09 (which
*is* YYMMDD) gets copy-pasted into DTM (which is CCYYMMDD in 004010) without
adjusting the format.

**What it costs:** Depending on the receiver's date parser, this is either a
hard parse failure or a date that's silently misinterpreted — a ship date
100 years in the wrong direction is a fun one to explain to a customer.

### `cttMismatch(offset?)`

**What happens:** CTT's line count no longer matches the actual number of
PO1/IT1 lines in the document.

**Why it happens in production:** A line gets added, removed, or filtered by
business logic after the summary segment was already built.

**What it costs:** A receiver that cross-checks CTT against the actual line
count (many do, as a basic integrity check) rejects the whole transaction —
for a bug that has nothing to do with any individual line being wrong.

### `missingRef(qualifier)`

**What happens:** Drops a REF segment with the given qualifier — most
commonly a partner-required one like `"DP"` (Department Number).

**Why it happens in production:** The base document generation logic doesn't
know about a specific partner's required-but-not-globally-mandatory
segments, so a generic PO is missing a field that partner considers
essential.

**What it costs:** This is one of the single most common chargeback
triggers in retail/industrial EDI: a big-box or distributor partner requires
a specific REF (department, store, cost center) on every PO, and its absence
on the matching invoice is an automatic deduction.

---

## Category C — Sequence / Acknowledgment

All scenario-level: these are about what arrives, what doesn't, and in what
order across a document flow.

### `fa997Missing()`

**What happens:** The 997 is dropped from the scenario bundle entirely
(`flow.fa` is `null`).

**Why it happens in production:** Network failure, a queue that silently
drops a message, or a receiver that simply never implemented 997 generation.

**What it costs:** The sender has no positive confirmation of receipt. Some
systems handle this gracefully (resend after a timeout, with dedup on the
receiving end); many don't, and the sender either assumes success
incorrectly or resends into a system that has no way to tell it already got
the first copy.

### `fa997Rejected()`

**What happens:** The 997 arrives, but AK5 (and AK9) say `R` — Rejected —
instead of `A`.

**Why it happens in production:** The receiver's translator found something
wrong with the acknowledged transaction (bad syntax, failed a validation
rule) and correctly reported that.

**What it costs:** The interesting failure isn't the rejection — it's
whether anything downstream of "receive a 997" actually reads AK5 at all.
Plenty of integrations log the 997 as "delivered" without checking whether
it was actually accepted.

### `fa997UnknownGroup()`

**What happens:** The 997's AK1 references a functional group control
number that doesn't match any group this scenario actually sent.

**Why it happens in production:** A VAN or translator misroutes an
acknowledgment, or two interchanges' control numbers collide (see
`duplicateIsaControl`) and the wrong one gets acknowledged.

**What it costs:** A receiver that blindly correlates by control number
without validating it was actually one of theirs marks the wrong
transaction as acknowledged — or an alert fires for an acknowledgment nobody
can explain.

### `outOfOrderInterchange()`

**What happens:** Swaps the ISA and GS date/time stamps between the ASN and
its own PO Acknowledgment, so the shipment notice appears to have been sent
before the order was even acknowledged.

**Why it happens in production:** Network delay, queue reordering, or a
sender's batch job running out of sequence. EDI transport makes no
ordering guarantee.

**What it costs:** Any downstream logic that assumes documents arrive in
business order (ack before ship notice, ship notice before invoice) gets
confused — reconciliation reports flag a "shipment with no order," which is
a support ticket that's actually just a timing artifact.

---

## Category D — 856-specific

Chargeback territory: ASN bugs that cost real money because they're
discovered at the dock, not in a test suite.

### `hlOrphan()`

**What happens:** Every Item-level HL loop is repointed to a Pack HL parent
ID that doesn't exist anywhere in the interchange.

**Why it happens in production:** A packing-hierarchy bug in the shipping
system's EDI generator — an HL ID gets renumbered or dropped without
updating the children that reference it as a parent.

**What it costs:** A receiver building the shipment hierarchy from HL
parent/child links can't place the item anywhere in the tree. Depending on
the parser, that's either a hard failure or an item that silently vanishes
from the receiving system's expected-contents list.

### `ssccInvalid()`

**What happens:** Flips the GS1 mod-10 check digit on the MAN segment's
SSCC-18, so it's no longer a valid license plate number.

**Why it happens in production:** A labeling system generates the SSCC and
the check digit separately, and a bug (or a manual correction) desyncs them.

**What it costs:** The physical barcode label won't scan clean at the
receiving dock. Depending on the DC's process, that's a manual override
(slow, error-prone) or a rejected pallet.

### `asnAfterDelivery()`

**What happens:** The ASN's own creation date/time (BSN) is set *after* the
estimated delivery date it declares in DTM\*017.

**Why it happens in production:** A shipment goes out and the ASN gets
generated late — a batch job that runs once a day, or a manual EDI
resend after an initial failure — so the "advance" in Advance Ship Notice
stops being true.

**What it costs:** The entire point of an ASN is to arrive *before* the
goods so a receiving dock can prepare. An ASN that arrives after delivery
provides none of that value and usually means the shipment was received
blind, which slows down putaway and increases receiving discrepancies.

### `asnQtyMismatch(overage?)`

**What happens:** The ASN reports more units shipped, on its first line,
than the PO actually ordered.

**Why it happens in production:** A picking error, a case-pack rounding
issue (shipping full cases against an each-quantity order), or the ASN
being generated from a different data source than the one that confirmed
the order.

**What it costs:** The single most expensive everyday EDI fault. It's the
direct cause of overbilling, of receiving discrepancies that trigger a
chargeback investigation, and — if it reaches the 810 uncaught — of an
invoice for goods that were never ordered in that quantity.
