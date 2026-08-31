/** A flat step recorder with an injectable clock. Every run can say what
 * happened, in order, with timings - and nothing else. No confidences to
 * transition (claims do not carry any), no side effects. */

export interface TraceStep {
  name: string;
  at: number;
  detail?: string;
}

export interface TraceReport {
  steps: TraceStep[];
  startedAt: number;
  elapsedMs: number;
}

export class Trace {
  private readonly steps: TraceStep[] = [];
  private readonly startedAt: number;
  private readonly clock: () => number;

  constructor(clock: () => number = Date.now) {
    this.clock = clock;
    this.startedAt = clock();
  }

  step(name: string, detail?: string): this {
    this.steps.push({ name, at: this.clock(), ...(detail != null ? { detail } : {}) });
    return this;
  }

  finish(): TraceReport {
    return {
      steps: [...this.steps],
      startedAt: this.startedAt,
      elapsedMs: this.clock() - this.startedAt
    };
  }
}
