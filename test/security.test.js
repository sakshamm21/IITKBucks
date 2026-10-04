/**
 * Security regression tests for the IITkBucks node.
 *
 * These lock in the hardening applied to the original backend: each test asserts
 * that a previously-exploitable request is now rejected, and that legitimate
 * behaviour is preserved. They run against a live node started by the caller.
 *
 * Usage:  IITKBUCKS_TEST_PORT=3100 node --test test/
 */

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const PORT = process.env.IITKBUCKS_TEST_PORT || '3100';
const BASE = `http://127.0.0.1:${PORT}`;

function makeKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

// Mirrors aliasChallenge() on the server.
function aliasChallenge(name) {
  return `IITKBUCKS-ALIAS:${Buffer.byteLength(name, 'utf8')}:${name}`;
}

function signChallenge(privateKeyPem, name) {
  return crypto
    .sign('sha256', Buffer.from(aliasChallenge(name), 'ascii'), {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    })
    .toString('hex');
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function get(path, headers = {}) {
  return fetch(`${BASE}${path}`, { headers });
}

// ---------------------------------------------------------------- aliases

test('alias claim without an ownership proof is rejected', async () => {
  const { publicKey } = makeKeyPair();
  const status = await post('/addAlias', { alias: 'squatted', publicKey });
  assert.strictEqual(status, 403, 'alias without signature must be refused');
});

test('alias claim signed by a DIFFERENT key is rejected', async () => {
  const claimant = makeKeyPair();
  const attacker = makeKeyPair();
  const status = await post('/addAlias', {
    alias: 'stolen1',
    publicKey: claimant.publicKey,
    signature: signChallenge(attacker.privateKey, 'stolen1'),
  });
  assert.strictEqual(status, 403, 'proof must match the claimed key');
});

test('a proof cannot be replayed to claim a different alias', async () => {
  const attacker = makeKeyPair();
  const signature = signChallenge(attacker.privateKey, 'replay01');
  const status = await post('/addAlias', {
    alias: 'replay02',
    publicKey: attacker.publicKey,
    signature,
  });
  assert.strictEqual(status, 403, 'signature must be bound to the alias name');
});

test('a legitimate alias claim is accepted and resolvable', async () => {
  const { publicKey, privateKey } = makeKeyPair();
  const name = `real${Date.now().toString(36).slice(-6)}`;
  const status = await post('/addAlias', {
    alias: name,
    publicKey,
    signature: signChallenge(privateKey, name),
  });
  assert.strictEqual(status, 200, 'valid proof must be accepted');

  const res = await fetch(`${BASE}/getPublicKey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias: name }),
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.ok(body.publicKey.includes('BEGIN PUBLIC KEY'), 'alias must map to a public key');
});

test('an alias cannot be claimed twice', async () => {
  const first = makeKeyPair();
  const second = makeKeyPair();
  const name = `dup${Date.now().toString(36).slice(-6)}`;
  assert.strictEqual(
    await post('/addAlias', {
      alias: name,
      publicKey: first.publicKey,
      signature: signChallenge(first.privateKey, name),
    }),
    200,
  );
  assert.strictEqual(
    await post('/addAlias', {
      alias: name,
      publicKey: second.publicKey,
      signature: signChallenge(second.privateKey, name),
    }),
    400,
    'second claim on a taken name must be refused',
  );
});

test('malformed alias names are rejected', async () => {
  const { publicKey, privateKey } = makeKeyPair();
  for (const bad of ['', 'ab', 'A'.repeat(40), 'has space', '../etc']) {
    const status = await post('/addAlias', {
      alias: bad,
      publicKey,
      signature: signChallenge(privateKey, bad),
    });
    assert.ok(status === 400 || status === 403, `"${bad}" must be rejected, got ${status}`);
  }
});

// ------------------------------------------------------------ block access

test('block path traversal is not served', async () => {
  for (const p of ['..%2Fconfig.json', '..%2F..%2Fpackage.json', '0%00']) {
    const res = await get(`/getBlock/${p}`);
    assert.notStrictEqual(res.status, 200, `traversal ${p} must not return a file`);
  }
});

test('a non-numeric block index is not served', async () => {
  const res = await get('/getBlock/abc');
  assert.notStrictEqual(res.status, 200);
});

// -------------------------------------------------------------- health

test('node reports chain info', async () => {
  const res = await get('/getNodeInfo');
  assert.strictEqual(res.status, 200);
  const info = await res.json();
  assert.ok(Number.isInteger(info.blockIndex), 'blockIndex must be an integer');
  assert.ok(Array.isArray(info.peers));
  assert.ok(Array.isArray(info.aliases));
});

/**
 * blockIndex is the height, meaning the index the next block will use. The last
 * block actually on disk is therefore blockIndex - 1, and blockIndex itself must not
 * resolve. This regressed once: the replay loop incremented past the final block, so
 * the node advertised a height whose block did not exist and the explorer 404'd.
 */
test('reported height matches the last block that exists', async () => {
  const res = await get('/getNodeInfo');
  const info = await res.json();
  if (info.blockIndex === 0) return; // empty chain

  const tipRes = await get(`/getBlock/${info.blockIndex - 1}`);
  assert.strictEqual(tipRes.status, 200, `block ${info.blockIndex - 1} should exist`);

  const nextRes = await get(`/getBlock/${info.blockIndex}`);
  assert.notStrictEqual(
    nextRes.status,
    200,
    `block ${info.blockIndex} is not mined yet and must not be served`
  );
});

test('cors is not a wildcard when an allowlist is configured', async () => {
  const res = await get('/getNodeInfo', { headers: { Origin: 'https://evil.example' } });
  const allow = res.headers.get('access-control-allow-origin');
  if (process.env.IITKBUCKS_CORS_ORIGINS) {
    assert.notStrictEqual(allow, '*', 'wildcard CORS must not be used with an allowlist');
  }
});
