/** A runtime network trap, and the negative control for the offline claim.
 *
 * The lint (test/firewall.test.ts) reads source text. This reads nothing:
 * it replaces the primitives themselves, so a network call from anywhere -
 * a dynamic import, a transitive dependency, an eval'd string - throws
 * instead of connecting. Node's permission model was doing none of this:
 * it has no network permission on any release, so `node --permission` gated
 * files and child processes and left sockets wide open, and a CI job built
 * on it would pass identically if the sandbox did nothing at all.
 *
 * Import it as a preload for the whole suite:
 *   node --import ./test/no-network.ts --test "test/*.test.ts"
 *
 * or import it directly from a test, which is what the negative control in
 * test/no-network.test.ts does - so the trap is proven to fire on every
 * ordinary run, not only in the offline CI job. A guard that cannot be
 * shown to work is not a guard.
 *
 * One measured limit: `import { lookup } from 'node:dns'` binds the
 * original function, and userland cannot replace an ESM named-export
 * binding, so that one path escapes. It resolves a hostname; it opens no
 * connection. Everything that does open a connection - node:http,
 * node:https, tls, http2, fetch, any client library - funnels through
 * net.Socket.prototype.connect, and a prototype method is trapped on every
 * access path. */

import dns from 'node:dns';
import http2 from 'node:http2';
import net from 'node:net';
import tls from 'node:tls';

export const NO_NETWORK = 'ERR_NO_NETWORK';

/** Every trap throws this, tagged, so a test can tell "the trap fired"
 * from "the call failed for some other reason" - the difference between a
 * negative control and a coincidence. */
function refuse(primitive: string): never {
  const err = new Error(
    `${primitive} was called: this package must never reach the network`
  ) as Error & { code: string; primitive: string };
  err.name = 'NetworkAttempt';
  err.code = NO_NETWORK;
  err.primitive = primitive;
  throw err;
}

const trap = (primitive: string) => (): never => refuse(primitive);

/** What was replaced, so the control can prove each one individually. */
export const TRAPPED: ReadonlyArray<string> = [
  'net.Socket.prototype.connect',
  'dns.lookup',
  'dns.promises.lookup',
  'tls.connect',
  'http2.connect',
  'fetch'
];

let armed = false;

export function armNetworkTrap(): void {
  if (armed) return;
  armed = true;
  // Sockets first: node:http, node:https, undici and every client library
  // ultimately arrive here, so this is the one that matters most.
  (net.Socket.prototype as unknown as Record<string, unknown>).connect = trap(
    'net.Socket.prototype.connect'
  );
  (dns as unknown as Record<string, unknown>).lookup = trap('dns.lookup');
  (dns.promises as unknown as Record<string, unknown>).lookup = trap('dns.promises.lookup');
  (tls as unknown as Record<string, unknown>).connect = trap('tls.connect');
  (http2 as unknown as Record<string, unknown>).connect = trap('http2.connect');
  (globalThis as unknown as Record<string, unknown>).fetch = trap('fetch');
}

export const isArmed = (): boolean => armed;

armNetworkTrap();
