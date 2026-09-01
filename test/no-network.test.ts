/** The negative control. Every guard in this repo is asserted to fire by
 * deliberately doing the thing it forbids: without that, the offline job
 * would pass identically if the trap were an empty file. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_NETWORK, TRAPPED, isArmed } from './no-network.ts';

const fired = (err: unknown): boolean =>
  err instanceof Error && (err as Error & { code?: string }).code === NO_NETWORK;

test('the trap is armed by importing it: no test process reaches the network by accident', () => {
  assert.ok(isArmed());
  assert.equal(TRAPPED.length, 6);
});

test('every trapped primitive throws the tagged error when called deliberately', async () => {
  const net = await import('node:net');
  const dns = await import('node:dns');
  const tls = await import('node:tls');
  const http2 = await import('node:http2');

  assert.throws(() => new net.Socket().connect(80, '127.0.0.1'), fired, 'net.Socket#connect');
  assert.throws(() => net.connect(80, '127.0.0.1'), fired, 'net.connect');
  assert.throws(() => tls.connect({ host: '127.0.0.1', port: 443 }), fired, 'tls.connect');
  assert.throws(() => http2.connect('https://example.invalid'), fired, 'http2.connect');
  assert.throws(() => fetch('http://example.invalid'), fired, 'fetch');
  // node:dns is patched on the module object, which is what a default
  // import and require() both see. See the named-import limit below.
  assert.throws(() => dns.default.lookup('example.invalid', () => {}), fired, 'dns.lookup');
  assert.throws(() => dns.promises.lookup('example.invalid'), fired, 'dns.promises.lookup');
});

test('the indirect path is trapped too: node:http goes through the socket', async () => {
  const http = await import('node:http');
  await assert.rejects(
    new Promise((resolve, reject) => {
      try {
        const req = http.get('http://example.invalid/probe', resolve);
        req.on('error', reject);
      } catch (err) {
        reject(err);
      }
    }),
    fired,
    'an http.get must not be able to escape the socket trap'
  );
});

test('the one path the trap cannot take still cannot open a connection', async () => {
  // Honest limit, measured on node 24: `import { lookup } from 'node:dns'`
  // binds the original function and userland cannot replace that binding,
  // so a named-import dns.lookup escapes the trap. It resolves a name; it
  // opens nothing. Every path that actually connects goes through
  // net.Socket.prototype.connect, which is a prototype method and so is
  // trapped on every access path - proven above and by the http.get case.
  const net = await import('node:net');
  const { Socket, connect, createConnection } = net;
  assert.throws(() => new Socket().connect(80, '127.0.0.1'), fired, 'destructured Socket');
  assert.throws(() => connect(80, '127.0.0.1'), fired, 'destructured net.connect');
  assert.throws(() => createConnection(80, '127.0.0.1'), fired, 'destructured createConnection');
});

test('the trap distinguishes itself from an ordinary failure', () => {
  // A guard that cannot tell "denied" from "refused by the peer" proves
  // nothing; this is exactly what the permission-model job could not do.
  assert.ok(!fired(new Error('connect ECONNREFUSED 127.0.0.1:1')));
  assert.ok(!fired(Object.assign(new Error('nope'), { code: 'ECONNREFUSED' })));
});
