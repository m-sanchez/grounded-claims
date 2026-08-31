# grounded-claims

![TypeScript](https://img.shields.io/badge/TypeScript-erasable_syntax-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D22.18-5FA04E?logo=nodedotjs&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-0-B45309)
[![CI](https://github.com/m-sanchez/grounded-claims/actions/workflows/test.yml/badge.svg)](https://github.com/m-sanchez/grounded-claims/actions/workflows/test.yml)
![Firewall](https://img.shields.io/badge/network_imports-forbidden_by_test-B45309)
![License](https://img.shields.io/badge/license-MIT-6E6E6E)

The verification kit. A model drafts claims about a body of evidence; this
code decides which claims may reach the reader.

[More tools](https://github.com/m-sanchez) ·
[Working rules](https://miguelsanchez.co.uk/ethics) ·
[The pattern, live](https://miguelsanchez.co.uk/careful-machine)

Four structural guarantees, each carried by construction rather than
convention:

1. **The LLM judge is advisory, structurally.** Checks are `decisive` or
   `advisory`, and the runner records an advisory result as a note
   whatever it says - or however it fails. A judge can inform the record;
   it cannot flip an outcome, in either direction, and a judge that
   throws is still just a note.
2. **The composer cannot introduce claims.** It renders accepted claim
   text verbatim, re-resolves every citation against the supplied
   evidence, and refuses identifier drift detected after ruling. That is
   the whole compose-time guarantee: custom semantic checks run at ruling
   time, not again at compose time.
3. **The package is offline, twice over.** A recursive lint test fails on
   any network, model-SDK, or process import anywhere under `src/`; and
   CI runs the entire suite on Node 26 under the permission model with no
   network allowance, so an escaped network call fails the build, not
   just the grep.
4. **Every run replays from its own record.** A `RunRecord` is
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

## Honest limits

- `verbatim` matches tokens against the joint corpus of all cited
  evidence: a claim asserting facts from two documents together passes if
  each token appears in either. Pair it with `support` when co-occurrence
  matters.
- The contested boundary is strict: with the default 0.5, exactly half
  rejected still ships `grounded`; strictly more ships `contested`.
- A record defends against edits by someone who did not re-run `hashOf`,
  which this package exports. There is no signature and no external
  anchor; replay proves internal consistency, not custody.

## Install

```bash
npm install github:m-sanchez/grounded-claims#v1.1.0
```

Not yet on npm; the pinned git tag is the supported install and CI proves
the packed tarball imports cleanly. Zero runtime dependencies.

## Develop

```bash
npm ci            # dev-only: typescript
npm test
npm run typecheck
```

Node 22.18+ (erasable-syntax TypeScript; node runs the sources directly).

## The tests are the point

| Test | Claim |
| :-- | :-- |
| the judge cannot rescue a bad claim | heard, recorded, overruled |
| the judge cannot sink a good claim | advisory in both directions |
| a fabricated identifier dies at verbatim, named | the reader never meets the invented number |
| zero survivors is a composed refusal | declined, not an empty confident page |
| a claim edited after ruling dies at the composer | the last gate re-derives, it does not trust |
| no src file imports a network primitive, recursively | the firewall lint covers every file, present and future |
| a throwing judge stays a note; a throwing scorer rejects, named | the plug-in points cannot crash or hijack the ruling |
| a tampered record fails replay, divergence named | the audit trail defends itself |
