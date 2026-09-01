# CLAIMS

Every externally falsifiable behavioural or headline claim in `README.md`
and in the `package.json` description, mapped to the executable test that
enforces it. A claim with no test in this table is a claim that should not
be in the README; if you add prose that asserts behaviour, add the row and
the test with it.

Run `npm test` to execute all of them; `npm run test:offline` runs the same
suite under the network trap.

Not listed here: type-level facts the compiler enforces (`npm run
typecheck`, with `erasableSyntaxOnly`), and the CI-only steps named at the
bottom.

## package.json description

| Claim | Enforcing test |
| :-- | :-- |
| "Cite-or-refuse for LLM answers, enforced in code" | `test/gates.test.ts::an uncited claim refuses at faithfulness, claim named` |
| "an ordered gate pipeline over the turn" | `test/gates.test.ts::the first refusal stops the pipeline: nothing after it runs` |
| "a check chain over each claim" | `test/gates.test.ts::the check chain is the deep-check slot: a custom chain refuses with its own verdict` |
| "contained plug-ins" | `test/containment.test.ts::a throwing custom check is contained: named rejection if decisive, a note if advisory` |
| "a composer that cannot introduce" | `test/compose.test.ts::only accepted claims appear, and the disclosure counts everything` |
| "…or forge" | `test/forgery.test.ts::a claim that forges a disclosure line cannot be composed` |
| "replayable hashed run records" | `test/replay.test.ts::a record replays identically from its own frozen inputs` |

## Headline

| Claim | Enforcing test |
| :-- | :-- |
| No evidence, no answer | `test/gates.test.ts::empty retrieval refuses before anything is parsed: structure never runs` |
| Every number in the answer must appear in the source it points at | `test/verbatim.test.ts::the digit-substring escape dies at verbatim end to end, token named` |
| The code decides which claims survive | `test/ruling.test.ts::a claim grounded in its citations is accepted` |
| …and what the reader is told about the ones that did not | `test/compose.test.ts::only accepted claims appear, and the disclosure counts everything` |

## Two layers

| Claim | Enforcing test |
| :-- | :-- |
| The turn pipeline runs sufficiency → structure → executability → faithfulness → advisory | `test/gates.test.ts::a grounded answer ships, with every gate on record` |
| The first refusal stops the pipeline; every gate after it never runs | `test/gates.test.ts::the first refusal stops the pipeline: nothing after it runs` |
| Gates compose in whatever order the caller writes, and the order is on record | `test/gates.test.ts::the gates compose in any order the caller writes, and order is on record` |
| The default claim chain is citations → verbatim | `test/compose.test.ts::only accepted claims appear, and the disclosure counts everything` |
| faithfulness is the check chain applied per claim, not a second implementation | `test/gates.test.ts::a fabricated identifier refuses at faithfulness through the shared chain` |

## Guarantee 1 — a check or gate cannot decide by acting

| Claim | Enforcing test |
| :-- | :-- |
| No check, advisory or decisive, can change the ruling by mutating its arguments | `test/containment.test.ts::no check, advisory or decisive, can change the ruling by mutating its arguments` |
| The caller's claims and evidence are never mutated | `test/containment.test.ts::the caller keeps its own claims and evidence: rule() mutates nothing it is handed` |
| A write attempt throws and is contained: decisive refuses named, advisory becomes a note | `test/containment.test.ts::a throwing custom check is contained: named rejection if decisive, a note if advisory` |
| An advisory gate cannot flip refuse to ship by rewriting the answer | `test/gates-containment.test.ts::an advisory gate cannot flip refuse to ship by rewriting the answer` |
| A gate cannot mutate what later gates see, nor what the caller holds | `test/gates-containment.test.ts::a gate cannot mutate what later gates see, nor what the caller holds` |
| A gate cannot rewrite an evidence record the audit trail will quote | `test/gates-containment.test.ts::a gate cannot rewrite an evidence record the audit trail will quote` |
| The judge cannot rescue a bad claim, nor sink a good one | `test/ruling.test.ts::the judge is structurally unable to rescue a bad claim`; `test/ruling.test.ts::the judge is structurally unable to sink a good claim` |
| A record freezes the inputs as supplied, not as a check left them | `test/containment.test.ts::record() freezes the evidence as it was before the chain ran, not after` |

## Guarantee 2 — a plug-in that fails cannot take the request with it

| Claim | Enforcing test |
| :-- | :-- |
| A throwing sufficiency predicate becomes a named refusal | `test/gates-containment.test.ts::a throwing sufficiency predicate is a named refusal, not a crash` |
| A throwing parser becomes a named refusal | `test/gates.test.ts::a malformed draft is rejected, never repaired` |
| A parser returning a non-answer becomes a named refusal | `test/gates.test.ts::a parser that returns a non-answer refuses rather than being trusted` |
| A throwing custom gate becomes a named refusal | `test/gates-containment.test.ts::a throwing custom gate is a named refusal, not a crash` |
| A throwing pathToYes still yields an actionable refusal | `test/gates-containment.test.ts::a throwing pathToYes still yields a refusal the reader can act on` |
| A throwing custom check becomes a named rejection | `test/containment.test.ts::a throwing custom check is contained: named rejection if decisive, a note if advisory` |
| A throwing scorer rejects, named; NaN is not a pass | `test/ruling.test.ts::a throwing scorer is a named rejection, and NaN is not a pass` |
| A throwing advisory stays advisory | `test/gates-containment.test.ts::a throwing advisory is still advisory: recorded, never a refusal, never a crash`; `test/ruling.test.ts::a throwing judge is still advisory: recorded, never decisive, never a crash` |
| Check.run is synchronous, and an async plug-in is named rather than swallowed | `test/async-plugin.test.ts::an async judge says so, instead of recording [object Promise]`; `test/async-plugin.test.ts::an async scorer is a named rejection, not a nonsense comparison` |

## Guarantee 3 — nothing passes by not being measured

| Claim | Enforcing test |
| :-- | :-- |
| An answer with no claims refuses | `test/gates-containment.test.ts::an answer with zero claims refuses; vacuous truth is not a pass` |
| A claim that cites nothing refuses | `test/vacuous.test.ts::a claim that cites nothing is not grounded` |
| …and never reaches the page with an empty citation bracket | `test/vacuous.test.ts::and it never reaches the page with an empty citation bracket` |
| An answer-reading gate refuses when no gate produced an answer | `test/gates.test.ts::a chain without structure cannot pass vacuously: answer-reading gates refuse` |
| The parsed answer is pipeline state and cannot be handed in to skip structure | `test/gates-containment.test.ts::the parsed answer is pipeline state: it cannot be handed in to skip structure` |
| Two runs of one context cannot share a stale answer | `test/gates-containment.test.ts::two runs of one context cannot share a stale answer` |
| Zero survivors is a composed refusal, not an empty confident page | `test/ruling.test.ts::zero survivors is insufficient: declined, not composed`; `test/compose.test.ts::an insufficient ruling composes its refusal, never an empty page` |

## Guarantee 4 — the composer

| Claim | Enforcing test |
| :-- | :-- |
| Only accepted claims appear | `test/compose.test.ts::only accepted claims appear, and the disclosure counts everything` |
| Every citation is re-resolved at compose time | `test/compose.test.ts::evidence swapped out from under an accepted claim also dies at compose` |
| Identifier drift found after ruling refuses | `test/compose.test.ts::a claim edited after ruling dies at the composer, not on the page` |
| Claim text carrying a line break refuses | `test/forgery.test.ts::a claim that forges a disclosure line cannot be composed` |
| Claim text opening as a rule, heading, quote or `disclosure:` refuses | `test/forgery.test.ts::every markdown structural opener in claim text is drift, not content` |
| Ordinary punctuation still composes | `test/forgery.test.ts::ordinary claim text with punctuation still composes` |
| A contested ruling carries its marker above the survivors | `test/compose.test.ts::a contested ruling carries its marker above the survivors` |

## Guarantee 5 — offline, and the guard is proven

| Claim | Enforcing test |
| :-- | :-- |
| No file under src/ imports a network, model-SDK or process primitive | `test/firewall.test.ts::firewall: src/<file> imports no network, model, or process primitive` (one per file) |
| The lint covers static, dynamic and require escapes — all 26 of them | `test/firewall.test.ts::the lint catches every escape it claims to, dynamic imports included` |
| The lint is not a rubber stamp | `test/firewall.test.ts::the lint is not a rubber stamp: ordinary source passes it` |
| The runtime trap replaces socket, DNS, TLS, HTTP/2 and fetch | `test/no-network.test.ts::every trapped primitive throws the tagged error when called deliberately` |
| An indirect call (node:http) is trapped too | `test/no-network.test.ts::the indirect path is trapped too: node:http goes through the socket` |
| The negative control fires: a deliberate connection attempt throws | `test/no-network.test.ts::the trap is armed by importing it: no test process reaches the network by accident` |
| The trap can tell denial from an ordinary connection failure | `test/no-network.test.ts::the trap distinguishes itself from an ordinary failure` |
| The one path the trap cannot take still cannot open a connection | `test/no-network.test.ts::the one path the trap cannot take still cannot open a connection` |

## Guarantee 6 — records and replay

| Claim | Enforcing test |
| :-- | :-- |
| The same run produces the same record hash | `test/replay.test.ts::the same run produces the same record hash` |
| A record replays identically from its own frozen inputs | `test/replay.test.ts::a record replays identically from its own frozen inputs` |
| A tampered record fails replay, divergence named | `test/replay.test.ts::a tampered record fails replay with the divergence named` |
| A record replayed under a different chain is not identical, and the chain is named | `test/replay-chain.test.ts::a record replayed under a different chain is not identical, and the chain is named` |
| Chain order is part of the run | `test/replay-chain.test.ts::a chain rebuilt in the wrong order diverges too: order is part of the run` |
| A record replayed under its own chain is identical | `test/replay-chain.test.ts::a record replayed under its own chain is identical` |
| hashOf is stable across semantically identical values | `test/replay.test.ts::hashOf is stable across semantically identical values` |
| The trace records ordered steps under an injectable clock | `test/replay.test.ts::the trace records ordered steps under an injectable clock` |

## Refusal codes

Each code in the README table is produced by a test.

| Code | Enforcing test |
| :-- | :-- |
| `sufficiency/floor` | `test/gates.test.ts::empty retrieval refuses before anything is parsed: structure never runs` |
| `sufficiency/predicate-error` | `test/gates-containment.test.ts::a throwing sufficiency predicate is a named refusal, not a crash` |
| `structure/parse` | `test/gates.test.ts::a malformed draft is rejected, never repaired` |
| `structure/missing` | `test/gates.test.ts::a chain without structure cannot pass vacuously: answer-reading gates refuse` |
| `executability/missing-capability` | `test/gates.test.ts::an answer requiring what the system cannot do refuses, operation named` |
| `faithfulness/empty-answer` | `test/gates-containment.test.ts::an answer with zero claims refuses; vacuous truth is not a pass` |
| `citations/uncited` | `test/vacuous.test.ts::a claim that cites nothing is not grounded` |
| `citations/ghost-cite` | `test/ruling.test.ts::a phantom citation dies at the citations check, named` |
| `verbatim/fabricated-token` | `test/verbatim.test.ts::the digit-substring escape dies at verbatim end to end, token named` |
| `support/below-floor` | `test/gates.test.ts::the check chain is the deep-check slot: a custom chain refuses with its own verdict` |
| `support/nan`, `support/scorer-error` | `test/ruling.test.ts::a throwing scorer is a named rejection, and NaN is not a pass` |
| `support/async-scorer` | `test/async-plugin.test.ts::an async scorer is a named rejection, not a nonsense comparison` |
| `check/error` | `test/containment.test.ts::a throwing custom check is contained: named rejection if decisive, a note if advisory` |
| `gate/error` | `test/gates-containment.test.ts::a throwing custom gate is a named refusal, not a crash` |

## Who refuses what

| Claim | Enforcing test |
| :-- | :-- |
| Every row of the published matrix is what the code does | `test/conformance.test.ts::the who-refuses-what matrix in the README is the measured one` |
| Each case behaves as recorded, at each layer | `test/conformance.test.ts::conformance: <case> - turn layer` and `- claim layer` (one pair per case) |

## The gates

| Claim | Enforcing test |
| :-- | :-- |
| Default sufficiency floor is one evidence record | `test/gates.test.ts::empty retrieval refuses before anything is parsed: structure never runs` |
| A custom sufficiency floor refuses in its own words | `test/gates.test.ts::a custom sufficiency floor refuses with its own words` |
| Refusing at sufficiency happens before the draft is parsed | `test/gates.test.ts::empty retrieval refuses before anything is parsed: structure never runs` |
| The draft is parsed, never repaired | `test/gates.test.ts::a malformed draft is rejected, never repaired` |
| Executability names the missing operation and no other | `test/gates.test.ts::an answer requiring what the system cannot do refuses, operation named` |
| The path to yes does not publish the deployment's capability inventory | `test/gates.test.ts::the path to yes does not publish the deployment capability inventory` |
| Faithfulness names every offending claim, not just the first | `test/gates.test.ts::faithfulness reports every offending claim, not just the first` |
| Advisory opinions are heard and structurally unable to refuse | `test/gates.test.ts::advisory opinions are heard and structurally unable to refuse` |

## The chain

| Claim | Enforcing test |
| :-- | :-- |
| citations: the claim must cite | `test/vacuous.test.ts::a claim that cites nothing is not grounded` |
| citations: every cited id must resolve | `test/ruling.test.ts::a phantom citation dies at the citations check, named` |
| verbatim extracts dates, hyphenated ids, caps codes and multi-digit numbers, longest match wins | `test/ruling.test.ts::identifier extraction sees dates, ids, codes, and multi-digit numbers only` |
| verbatim compares normalised tokens at identifier boundaries, never substrings | `test/verbatim.test.ts::a fabricated number that is a substring of a real one is still fabricated` |
| Separators, trailing zeros and case are not fabrication | `test/verbatim.test.ts::normalisation is pinned: separators, trailing zeros and case are not fabrication` |
| support states both the score and the floor | `test/ruling.test.ts::a support scorer below its floor is decisive, with both numbers stated` |
| The chain is an ordered array of caller-supplied checks | `test/containment.test.ts::no check, advisory or decisive, can change the ruling by mutating its arguments` |

## What verbatim catches, and what it does not

| Claim | Enforcing test |
| :-- | :-- |
| 21 of 28 fabrications caught, 7 missed, 0 false alarms on 14 faithful claims | `test/fabrication-rate.test.ts::the published fabrication table is the measured one` |
| Every per-category ratio in the published table | `test/fabrication-rate.test.ts::every row of the published per-category table is the measured one` |
| Every category verbatim claims to cover is covered completely | `test/fabrication-rate.test.ts::every category verbatim claims to cover is covered completely` |
| Every miss falls in a documented blind spot | `test/fabrication-rate.test.ts::the published fabrication table is the measured one` |

## Canonical form

| Claim | Enforcing test |
| :-- | :-- |
| The fixture is the shared one, not a local variant | `test/canonical-form.test.ts::the fixture is the shared one, not a local variant` |
| 27 accept cases match the canonical text and the sha256 | `test/canonical-form.test.ts::canonical form accepts <case>` (one per case) |
| 8 reject kinds throw | `test/canonical-form.test.ts::canonical form refuses <case> (<kind>)` (one per case) |
| -0 normalises to 0; undefined properties are omitted | `test/canonical-form.test.ts::the accept cases the fixture cannot carry are covered here` |
| Keys are sorted, so key order does not change the hash | `test/replay.test.ts::canonical bytes are key-order independent and reject non-finite numbers` |

## Rulings and honest limits

| Claim | Enforcing test |
| :-- | :-- |
| insufficient: nothing survived, the answer is declined | `test/ruling.test.ts::zero survivors is insufficient: declined, not composed` |
| contested: most claims died, survivors ship marked | `test/ruling.test.ts::a mostly-rejected answer ships its survivors contested` |
| Exactly half rejected still ships grounded; strictly more ships contested | `test/ruling.test.ts::exactly half rejected still ships grounded; strictly more ships contested` |
| verbatim is blind to units, negation and relations | `test/fabrication-rate.test.ts::every row of the published per-category table is the measured one` |
| verbatim matches against the joint corpus of all cited evidence | `test/fabrication-rate.test.ts::the published fabrication table is the measured one` (cases "two documents, one token each" and "two real tokens joined into one false fact") |
| A record defends against edits by someone who did not re-run hashOf | `test/replay.test.ts::a tampered record fails replay with the divergence named` |
| The dns named-import path escapes the trap but opens nothing | `test/no-network.test.ts::the one path the trap cannot take still cannot open a connection` |

## Coming from evidence-gates

| Claim | Enforcing test |
| :-- | :-- |
| `Evidence.data` is folded into the searchable corpus | `test/verbatim.test.ts::structured evidence values count as corpus, exactly as before` |
| `GateContext.answer` is gone: pipeline state, not a caller field | `test/gates-containment.test.ts::the parsed answer is pipeline state: it cannot be handed in to skip structure` |
| `Refusal` carries a `code` | every row of the refusal-code table above |
| The check chain is the deepCheck slot | `test/gates.test.ts::the check chain is the deep-check slot: a custom chain refuses with its own verdict` |

## Packaging

| Claim | Enforcing test |
| :-- | :-- |
| Zero runtime dependencies | `test/packaging.test.ts::zero runtime dependencies, as the badge and the README both say` |
| Every entry point the README uses is exported | `test/packaging.test.ts::every entry point the README uses is actually exported` |
| The git tag the README pins is the package version | `test/packaging.test.ts::the README states the version the package actually is` |
| The packed tarball imports cleanly | CI: `.github/workflows/test.yml`, job `test`, step `install proof` |
| The whole suite passes offline, with the trap armed and child processes denied | CI: `.github/workflows/test.yml`, job `offline` (`npm run test:offline`) |
| A deliberate connection attempt fails the build if the trap stops working | CI: `.github/workflows/test.yml`, job `offline`, step `negative control - the trap must fire` |
| Erasable-syntax TypeScript; node runs the sources directly | `npm run typecheck` (`erasableSyntaxOnly: true`), and the whole suite, which imports `src/*.ts` directly |
