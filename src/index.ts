export { corpusOf, fabricatedIn, identifiersIn, indexEvidence, normaliseIdentifier } from './evidence.ts';
export type { Claim, Evidence } from './evidence.ts';
export { frozenView } from './containment.ts';
export {
  advisory,
  executability,
  faithfulness,
  runPipeline,
  standardPipeline,
  structure,
  sufficiency
} from './gates.ts';
export type {
  Answer,
  Gate,
  GateContext,
  GateResult,
  GateView,
  PipelineOutcome,
  Refusal
} from './gates.ts';
export { citations, defaultChain, judge, support, verbatim } from './checks.ts';
export type { Check, CheckResult } from './checks.ts';
export { judgeClaim, rule } from './ruling.ts';
export type { ClaimVerdict, Ruling, RulingOptions, RulingStatus } from './ruling.ts';
export { ComposeIntegrityError, compose } from './compose.ts';
export type { ComposeOptions } from './compose.ts';
export { Trace } from './trace.ts';
export type { TraceReport, TraceStep } from './trace.ts';
export { canonicalize, hashOf, record, replay } from './replay.ts';
export type { ReplayResult, RunRecord } from './replay.ts';
