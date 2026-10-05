# grounded-claims

![TypeScript](https://img.shields.io/badge/TypeScript-erasable_syntax-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D22.18-5FA04E?logo=nodedotjs&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-0-B45309)
[![CI](https://github.com/m-sanchez/grounded-claims/actions/workflows/test.yml/badge.svg)](https://github.com/m-sanchez/grounded-claims/actions/workflows/test.yml)
![Firewall](https://img.shields.io/badge/network_imports-forbidden_by_test-B45309)
![License](https://img.shields.io/badge/license-MIT-6E6E6E)
[![npm](https://img.shields.io/npm/v/@m-sanchez/grounded-claims?color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/@m-sanchez/grounded-claims)

> **In plain English:** before an AI answer reaches a reader, this makes it
> prove it. No evidence, no answer; and every number in the answer has to
> appear in the source it points at.

A model drafts an answer about a body of evidence; this code decides
whether the answer may be shown, which of its claims survive, and what the
reader is told about the ones that did not.

[More tools](https://github.com/m-sanchez) ·
[Working rules](https://miguelsanchez.co.uk/ethics) ·
[The pattern, live](https://miguelsanchez.co.uk/careful-machine)

*Provenance: this came out of one body of production LLM work, extracted
and generalised into a standalone package. First published 2026-08-31. As
of 2.0.0 it also carries the gates that shipped separately as
`@m-sanchez/evidence-gates`; see [Two layers](#two-layers) and
[Coming from evidence-gates](#coming-from-evidence-gates).*

## Two layers

```
turn:    sufficiency -> structure -> executability -> faithfulness -> advisory
claim:                                  citations -> verbatim -> support -> judge
```

The **turn layer** rules on a whole answer: is the retrieval enough to
answer from at all, did the draft parse, does the answer require operations
this deployment offers, is every claim in it grounded. The first refusal
stops the pipeline and every gate after it never runs, because a refusal
that kept processing would be a warning, and warnings ship.

The **claim layer** rules on one claim at a time, and is what the
faithfulness gate runs. It also composes the page and freezes the run.

They share one vocabulary rather than translating between two: a statement
*is* a `Claim`, a retrieved chunk *is* an `Evidence`, and faithfulness is
the check chain applied per claim, not a second implementation of citation
resolution.

## What is actually guaranteed

1. **A check or gate cannot decide by acting.** Every plug-in is handed a
   frozen deep copy of what it needs, built once before the chain runs, so
   it cannot rewrite the claim that ships, the evidence the record freezes,
   or what the next check sees. Writes throw, and the throw is contained: a
   decisive check refuses with its name attached, an advisory becomes a
   note. This is asserted as a theorem over an adversarial battery, not
   sampled with three polite judges.
2. **A plug-in that fails cannot take the request with it.** All of the
   extension points - the sufficiency predicate, the parser, a gate's
   `run`, its `pathToYes`, a check's `run`, a scorer, an advisory opinion -
   are wrapped. A throwing plug-in becomes a named refusal or a note.
3. **Nothing passes by not being measured.** An answer with no claims
   refuses; a claim that cites nothing refuses; a gate that reads the
   parsed answer refuses when no gate produced one; the parsed answer is
   pipeline state, so it cannot be handed in to skip the parse.
4. **The composer cannot introduce claims, and claim text cannot forge
   document structure.** It renders accepted claim text verbatim,
   re-resolves every citation, refuses identifier drift found after ruling,
   and refuses claim text carrying a line break or opening as a rule,
   heading, quote or `disclosure:` line.
5. **The package is offline, and the guard is proven.** A lint refuses
   network, model-SDK and process imports anywhere under `src/` - static,
   dynamic and `require` - and is itself tested against 26 known escapes.
   CI additionally runs the whole suite under a runtime trap that replaces
   the socket, DNS, TLS, HTTP/2 and `fetch` primitives, with a negative
   control that deliberately attempts a connection and fails the build
   unless the trap denies it.
6. **Every run replays from its own record.** A `RunRecord` is
   self-contained JSON, canonically hashed, snapshotted at entry;
   `replay()` re-derives the ruling and names every divergence - including
   a chain that does not match the one the record was made with.

```ts
import {
  runPipeline, standardPipeline,   // turn layer
  rule, compose, record,           // claim layer
  citations, verbatim, judge
} from '@m-sanchez/grounded-claims';

const outcome = runPipeline(
  { question, retrieved, capabilities: ['summarize', 'export'], draft: modelOutput },
  standardPipeline({ parse: myAnswerSchema })
);

outcome.outcome;   // 'ship' | 'refuse'
outcome.refusal;   // { gate, code, reason, pathToYes } - a no you can act on
outcome.gates;     // what ran, what passed, in order

const ruling = rule(claims, evidence, { chain: [citations(), verbatim(), judge(myOpinion)] });
ruling.status;     // grounded | contested | insufficient
compose(ruling, evidence, { title: 'Ledger review' });
record(claims, evidence);   // the frozen run, hashes included
```

## Refusals carry a code

Route on the code; the prose is free to change.

| code | means |
| :-- | :-- |
| `sufficiency/floor` | the retrieval floor was not met |
| `sufficiency/predicate-error` | a bring-your-own sufficiency predicate threw |
| `structure/parse` | the draft did not parse, and is never repaired |
| `structure/missing` | an answer-reading gate ran with no `structure()` ahead of it |
| `executability/missing-capability` | the answer requires an operation this deployment does not offer |
| `faithfulness/empty-answer` | an answer with no claims |
| `citations/uncited` | a claim that cites nothing |
| `citations/ghost-cite` | a claim cites evidence that does not exist |
| `verbatim/fabricated-token` | an identifier in the claim is absent from the cited evidence |
| `support/below-floor`, `support/nan`, `support/scorer-error` | the semantic scorer said no, said NaN, or threw |
| `check/error`, `gate/error` | a plug-in threw and was contained |

## Who refuses what

Generated from `test/fixtures/conformance.fixture.json` and asserted
against this table by `test/conformance.test.ts`, so it cannot drift.

| failure | turn layer | claim layer |
| :-- | :-- | :-- |
| empty answer | refuses (`faithfulness/empty-answer`) | refuses |
| zero-citation claim | refuses (`citations/uncited`) | refuses (`citations/uncited`) |
| ghost citation | refuses (`citations/ghost-cite`) | refuses (`citations/ghost-cite`) |
| fabricated identifier | refuses (`verbatim/fabricated-token`) | refuses (`verbatim/fabricated-token`) |
| digit-substring fabrication | refuses (`verbatim/fabricated-token`) | refuses (`verbatim/fabricated-token`) |
| capability overreach | refuses (`executability/missing-capability`) | not covered by design |
| malformed draft | refuses (`structure/parse`) | not covered by design |
| post-ruling text edit | not covered by design | refuses at compose |
| forged disclosure line | not covered by design | refuses at compose |

"Not covered by design" means exactly that: the turn layer writes no page,
so it has no compose-time gate; the claim layer is handed claims rather
than a draft, and a claim carries no operations.

## The gates

- **`sufficiency(enough?)`**: is the retrieval enough to answer from at
  all? Default floor is one evidence record. Refusing here is the cheapest
  refusal available, *provided the caller defers generation until the
  pipeline asks for the draft* - `draft` is a field on the context, so the
  saving is real only if you build the context lazily.
- **`structure(parse)`**: the draft is parsed, never repaired. Repair here
  would launder the malformation.
- **`executability()`**: everything the answer requires must be a
  capability this deployment offers. The path to yes deliberately does not
  list the other capabilities: a refusal the reader sees must not publish
  the deployment's operation inventory to whoever probed for it.
- **`faithfulness(chain?)`**: every claim goes through the check chain, and
  every offending claim is named in one refusal rather than one per round
  trip. An answer with no claims refuses.
- **`advisory(opinion)`**: heard, recorded, structurally unable to refuse.

## The chain

- **`citations`** (decisive): the claim cites, and every cited id resolves.
- **`verbatim`** (decisive): identifier-like tokens in the claim
  (multi-digit numbers, dates, hyphenated ids, caps codes; longest match
  wins) must appear in the cited evidence, compared as normalised tokens at
  identifier boundaries - never as substrings.
- **`support(scorer, floor)`** (decisive, optional): bring your own
  semantic scorer; both the score and the floor land in the reason.
- **`judge(opinion)`** (advisory): an opinion with a microphone and no
  gavel.

The chain is an ordered array; write your own checks against the same
interface. `Check.run` is synchronous, deliberately - the package is
offline, so call your model outside it and thread the result in.

## What verbatim catches, and what it does not

Measured over the 42-case adversarial corpus in
`test/fixtures/fabrication.fixture.json`; the counts are asserted by
`test/fabrication-rate.test.ts`, so this table cannot quietly rot.

**21 of 28 fabrications caught, 7 missed, 0 false alarms on 14 faithful
claims.**

| failure shape | caught |
| :-- | :-- |
| digit-substring of a real number or id (47 against led-4471, 12 against 128) | 5 / 5 |
| id fragment or extension (led-447, led-44710) | 2 / 2 |
| transposed digits (182 for 128, led-4417 for led-4471) | 2 / 2 |
| invented or altered dates and years | 3 / 3 |
| invented codes and references | 2 / 2 |
| wholly invented numbers, accounts, amounts, percentages | 6 / 6 |
| unit and currency swaps (128 million for 128, USD for GBP) | 1 / 3 |
| negation and comparator flips (did not clear; more than for fewer than) | 0 / 2 |
| relation errors (sent for received, real tokens joined into a false fact) | 0 / 3 |

The last three rows are the honest part. `verbatim` is a token check: it
sees which identifiers are on the page, never what is claimed about them.
A negated sentence quotes the same tokens as the sentence it negates, and
so does a unit swap and a swapped subject. Those need `support(scorer,
floor)` with a real entailment model, or a human. The one unit case that is
caught is caught by accident - the number was glued to its unit in the
evidence, so the extractor never lifted it out.

## Canonical form

Records hash under the byte form shared across the family, so a record
written by one package verifies under another: object keys sorted by code
unit, no insignificant whitespace, undefined-valued properties omitted,
strings JSON-escaped, SHA-256 hex over UTF-8. Numbers: finite only; -0
normalised to 0; integer-valued numbers must be SAFE integers and print as
integers; non-integers must satisfy |x| >= 1e-4 and print as the shortest
round-trip decimal. The floor exists because JS writes 0.000007 where
Python writes 7e-06 — refusing those values is what makes the byte form
portable across languages.

`test/fixtures/canonical-form.fixture.json` is a byte-identical copy of the
shared fixture: 27 accept cases asserted for canonical text *and* sha256,
8 reject kinds asserted to throw.

## One deliberate omission

Claims carry no confidence field. A claim cannot certify itself, so there
is nothing on it for downstream code to be tempted to trust. Rulings derive
from check outcomes alone: `insufficient` (nothing survived; the answer is
declined, not composed), `contested` (most claims died; the survivors ship
marked), `grounded` (the ordinary case).

## Honest limits

- `verbatim` is blind to units, negation and relations - see the table
  above, with the measured misses.
- `verbatim` matches tokens against the joint corpus of all cited
  evidence: a claim asserting facts from two documents together passes if
  each token appears in either. Pair it with `support` when co-occurrence
  matters.
- The contested boundary is strict: with the default 0.5, exactly half
  rejected still ships `grounded`; strictly more ships `contested`.
- A record defends against edits by someone who did not re-run `hashOf`,
  which this package exports. There is no signature and no external
  anchor; replay proves internal consistency, not custody.
- The network trap is a test-time guard, not a sandbox. One path escapes
  it, measured on node 24: `import { lookup } from 'node:dns'` binds the
  original function and userland cannot replace an ESM named-export
  binding. It resolves a hostname and opens nothing - everything that
  opens a connection funnels through `net.Socket.prototype.connect`, which
  is trapped on every access path.
- `sufficiency` is only cheaper than generation if you build the context
  lazily; the type does not force you to.

## Coming from evidence-gates

`@m-sanchez/evidence-gates` and this package were two halves of the same
job with two vocabularies and an unimplemented seam. The gates now live
here. The mapping:

| evidence-gates | grounded-claims 2.0 |
| :-- | :-- |
| `Statement { text, cites }` | `Claim { text, cites }` |
| `Chunk { id, text }` | `Evidence { id, text, data? }` |
| `Answer.statements` | `Answer.claims` |
| `GateContext.answer` | removed: pipeline state, not a caller field |
| `faithfulness(deepCheck)` | `faithfulness(chain?)` - the check chain is the slot |
| `Refusal { gate, reason, pathToYes }` | `Refusal { gate, code, reason, pathToYes }` |

`Evidence.data` is folded into the searchable corpus, which is the trap a
hand-written adapter used to fall into: chunks carrying structured values
under-fed `verbatim` and got good claims rejected.

## Install

```bash
npm install @m-sanchez/grounded-claims
```

Also installable from a pinned git tag:
`github:m-sanchez/grounded-claims#v2.0.1`. CI proves the packed tarball
imports cleanly. Zero runtime dependencies.

## Develop

```bash
npm ci            # dev-only: typescript
npm test
npm run test:offline   # the whole suite under the network trap
npm run typecheck
```

Node 22.18+ (erasable-syntax TypeScript; node runs the sources directly).

## The tests are the point

Every externally falsifiable claim above is mapped to the test that
enforces it in [CLAIMS.md](CLAIMS.md).

| Test | Claim |
| :-- | :-- |
| no check can change the ruling by mutating its arguments | advisory means advisory, structurally, in both directions |
| rule() mutates nothing it is handed | a plug-in never touches the caller's objects |
| a throwing plug-in is a named refusal or a note, at every one of the five points | the plug-in points cannot crash or hijack |
| a digit-substring fabrication dies at verbatim, named | the reader never meets the invented number |
| 21 of 28 fabrications caught, 7 missed, 0 false alarms | the published table is the measured one |
| a claim that cites nothing is not grounded | vacuous truth is not a pass |
| an answer with zero claims refuses | nor is an empty confident page |
| a claim edited after ruling dies at the composer | the last gate re-derives, it does not trust |
| a forged disclosure line cannot be composed | claim text is content, never structure |
| a record replayed under a different chain is not identical | the audit trail refuses to flatter itself |
| a tampered record fails replay, divergence named | the audit trail defends itself |
| the lint catches all 26 known escapes, and no src file matches | the firewall covers dynamic imports too |
| every trapped primitive throws when called deliberately | the offline guard is shown to work, not assumed |
| 27 accept cases match canonical text and sha256 | the family byte form is one byte form |
