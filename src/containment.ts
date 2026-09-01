/** Containment: what a plug-in is allowed to touch.
 *
 * Every extension point in this package - checks, gates, scorers, judges,
 * parsers - is arbitrary code supplied by the caller, and arbitrary code
 * that is handed a live object will eventually write to it. One careless
 * line in an opinion function (normalising evidence text, trimming a
 * claim, annotating a chunk) is enough to change an outcome the caller
 * believes was decided by the decisive checks alone.
 *
 * So plug-ins are never handed the caller's objects. They are handed a
 * frozen deep copy: writes throw in strict mode (which every module here
 * is), and nothing they do can reach the ruling, the record, or the next
 * check in the chain. The runner catches the resulting TypeError like any
 * other plug-in failure, so a mutating plug-in becomes a named refusal or
 * a note - never a silent outcome flip. */

/** A deep, frozen copy. Plain objects and arrays are rebuilt; everything
 * else is passed through by value. Zero dependencies, and no
 * structuredClone: a plug-in-hostile field (a function, a class instance)
 * must not be able to make copying itself throw. */
export function frozenView<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => frozenView(item))) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      return Object.freeze(value) as T; // not a plain object: freeze in place, do not reshape
    }
    const copy: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      copy[key] = frozenView(v);
    }
    return Object.freeze(copy) as T;
  }
  return value;
}

/** The message a contained plug-in failure carries. Mutation attempts land
 * here as TypeErrors, which is the point: the guarantee is visible in the
 * refusal instead of silent in the outcome. */
export const containedFailure = (what: string, err: unknown): string =>
  `${what} failed and was contained: ${err}`;
