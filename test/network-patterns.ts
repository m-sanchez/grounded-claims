/** The source patterns the firewall lint refuses. Kept beside the lint but
 * outside it, so a second test can check the patterns themselves against
 * known escapes: a lint that only ever runs against clean source proves
 * that the source is clean, not that the lint works. */

export const FORBIDDEN: ReadonlyArray<RegExp> = [
  // static imports
  /from\s+['"]node:https?['"]/,
  /from\s+['"]node:net['"]/,
  /from\s+['"]node:dgram['"]/,
  /from\s+['"]node:dns(\/promises)?['"]/,
  /from\s+['"]node:tls['"]/,
  /from\s+['"]node:http2['"]/,
  /from\s+['"]node:vm['"]/,
  /from\s+['"]node:child_process['"]/,
  /from\s+['"](axios|undici|ws|got|node-fetch)['"]/,
  /from\s+['"]@?anthropic/i,
  /from\s+['"]openai/i,
  // dynamic imports and require escapes: `from '...'` syntax is not the
  // only way into a module, and the lint used to believe it was
  /\bimport\s*\(\s*['"](node:)?(https?|net|dgram|dns|tls|http2|vm|child_process)/,
  /\bimport\s*\(\s*['"](axios|undici|ws|got|node-fetch|openai|@?anthropic)/i,
  /\brequire\s*\(\s*['"](node:)?(https?|net|dgram|dns|tls|http2|vm|child_process)/,
  /\bcreateRequire\s*\(/,
  // runtime primitives
  /\bfetch\s*\(/,
  /ollama/i,
  /XMLHttpRequest|WebSocket|EventSource/
];

/** Source snippets that must each be caught by at least one pattern. Every
 * one of these is a way a network call could arrive in src/ tomorrow. */
export const KNOWN_ESCAPES: ReadonlyArray<string> = [
  "import http from 'node:http';",
  "import https from 'node:https';",
  "import net from 'node:net';",
  "import dgram from 'node:dgram';",
  "import dns from 'node:dns';",
  "import { lookup } from 'node:dns/promises';",
  "import tls from 'node:tls';",
  "import http2 from 'node:http2';",
  "import vm from 'node:vm';",
  "import { spawn } from 'node:child_process';",
  "import axios from 'axios';",
  "import { request } from 'undici';",
  "import Anthropic from '@anthropic-ai/sdk';",
  "import OpenAI from 'openai';",
  "const net = await import('node:net');",
  "const dns = await import('dns');",
  "await import('node:child_process');",
  "await import('undici');",
  "const net = require('node:net');",
  "const cp = require('child_process');",
  "const require_ = createRequire(import.meta.url);",
  "const res = await fetch(url);",
  "const client = new WebSocket(url);",
  "const x = new XMLHttpRequest();",
  "const stream = new EventSource(url);",
  "const reply = await ollama.chat({ model: 'llama3' });"
];
