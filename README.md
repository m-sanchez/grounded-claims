# grounded-claims

![TypeScript](https://img.shields.io/badge/TypeScript-erasable_syntax-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D22.6-5FA04E?logo=nodedotjs&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-0-B45309)
![Tests](https://img.shields.io/badge/tests-28_passing-2F6F44)
![Firewall](https://img.shields.io/badge/network_imports-forbidden_by_test-B45309)
![License](https://img.shields.io/badge/license-MIT-6E6E6E)

The verification kit. A model drafts claims about a body of evidence; this
code decides which claims may reach the reader.

[More tools](https://github.com/m-sanchez) ·
[Working rules](https://miguelsanchez.co.uk/ethics) ·
[The pattern, live](https://miguelsanchez.co.uk/careful-machine)

Three structural guarantees, each carried by construction rather than
convention:

1. **The LLM judge is advisory, structurally.** Checks are `decisive` or
   `advisory`, and the runner records an advisory result as a note
   whatever it says. A judge can inform the record; it cannot flip an
   outcome, in either direction.
2. **The composer cannot fabricate.** Only accepted claims render, every
   claim is re-checked against its cited evidence at compose time, drift
   throws instead of rendering, and a test walks `src/` and fails on any
   network, model-SDK, or process import in any file. Offline by proof,
   not by promise.
3. **Every run replays from its own record.** A `RunRecord` is
   self-contained JSON, canonically hashed; `replay()` re-derives the
   ruling from the record's frozen inputs and names every divergence.

```ts
import { rule, compose, judge, record } from 'grounded-claims';

const ruling = rule(claims, evidence, {
  chain: [citations(), verbatim(), judge(myLlmOpinion)]
});

ruling.status;      // grounded | contested | insufficient
compose(ruling, evidence, { title: 'Ledger review' });
// only accepted claims, each with its citations, plus a disclosure line:
// "disclosure: 3 claim(s) grounded, 1 rejected; checks: citations, verbatim, judge"

record(claims, evidence);   // the frozen run, hashes included
```

## One deliberate omission

Claims carry no confidence field. A claim cannot certify itself, so there
is nothing on it for downstream code to be tempted to trust. Rulings
derive from check outcomes alone: `insufficient` (nothing survived; the
answer is declined, not composed), `contested` (most claims died; the
survivors ship marked), `grounded` (the ordinary case).

## The chain

- **`citations`** (decisive): every cited id resolves to evidence.
- **`verbatim`** (decisive): identifier-like tokens in the claim
  (multi-digit numbers, dates, hyphenated ids, caps codes; longest match
  wins) must appear in the cited evidence. A number the evidence never
  mentions is named, and the claim dies for it.
- **`support(scorer, floor)`** (decisive, optional): bring your own
  semantic scorer (NLI, embeddings); both the score and the floor land in
  the reason.
- **`judge(opinion)`** (advisory): an opinion with a microphone and no
  gavel.

The chain is an ordered array; write your own checks against the same
interface.

## Run

```bash
npm install       # dev-only: typescript
npm test          # node's built-in runner, via --experimental-strip-types
npm run typecheck
```

Node 22.6+ (erasable-syntax TypeScript, node runs it directly). Zero
runtime dependencies.

## The tests are the point

| Test | Claim |
| :-- | :-- |
| the judge cannot rescue a bad claim | heard, recorded, overruled |
| the judge cannot sink a good claim | advisory in both directions |
| a fabricated identifier dies at verbatim, named | the reader never meets the invented number |
| zero survivors is a composed refusal | declined, not an empty confident page |
| a claim edited after ruling dies at the composer | the last gate re-derives, it does not trust |
| no src file imports a network primitive | the firewall is a test, and it covers everything |
| a tampered record fails replay, divergence named | the audit trail defends itself |
