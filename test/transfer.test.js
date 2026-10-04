/**
 * End-to-end validation that legitimate signed transfers still work after the
 * Phase 1 hardening. This is the regression guard for the crypto changes: if a fix
 * to verify_transaction ever breaks real spending, this test fails.
 *
 * Byte layout mirrors transactionToBuffer / verify_transaction in main.js:
 *   transaction = numInputs(4) || inputs || numOutputs(4) || outputs
 *   input       = txId(32) || index(4 BE) || signLen(4 BE) || signature
 *   output      = coins(8 BE) || pubkeyLen(4 BE) || pubkey(utf8)
 *   hashedOut   = sha256(numOutputs(4) || outputs)
 *   signBuff    = txId(32) || index(4 BE) || hashedOut(32)
 *
 * Requires a node whose mining keypair is on disk (node_public.pem/node_private.pem)
 * and which has mined at least one block so a spendable UTXO exists.
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');

const PORT = process.env.IITKBUCKS_TEST_PORT || '3100';
const BASE = `http://127.0.0.1:${PORT}`;

const normalize = (k) => k.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

function readPem(path) {
  try {
    return normalize(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

async function post(path, body) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildOutput(pubkey, amount) {
  const pk = Buffer.from(pubkey, 'utf8');
  const coins = Buffer.alloc(8);
  coins.writeBigInt64BE(BigInt(amount), 0);
  const len = Buffer.alloc(4);
  len.writeInt32BE(pk.length, 0);
  return { buf: Buffer.concat([coins, len, pk]) };
}

/**
 * Waits for the mempool to clear by mining whatever is pending, so each test starts
 * from a known state instead of inheriting transactions from a previous test.
 */
async function drainMempool(maxMs = 90000) {
  const deadline = Date.now() + maxMs;
  await fetch(`${BASE}/make`).catch(() => {});
  while (Date.now() < deadline) {
    const info = await (await fetch(`${BASE}/getNodeInfo`)).json();
    if (info.pendingTransactions === 0) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

test('a real signed transfer is accepted and funds a new recipient', async (t) => {
  const nodePubPem = readPem('./node_public.pem');
  const nodePrivPem = readPem('./node_private.pem');
  if (!nodePubPem || !nodePrivPem) {
    return t.skip('node mining keypair not present on disk');
  }

  // Drain any transactions left in the mempool by earlier tests: a stale forged
  // transaction may already have consumed the UTXO we are about to spend, which
  // would make this test fail for reasons unrelated to the code under test.
  await drainMempool();

  const utxoRes = await post('/getUnusedOutputs', { publicKey: nodePubPem });
  if (utxoRes.status !== 200) {
    return t.skip(`getUnusedOutputs returned ${utxoRes.status} (node has no funds yet)`);
  }
  const { unusedOutputs } = await utxoRes.json();
  if (!unusedOutputs || unusedOutputs.length === 0) {
    return t.skip('no spendable UTXO for node key');
  }

  const utxo = unusedOutputs[0];
  const recipient = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const recipientPem = normalize(recipient.publicKey);

  const total = BigInt(utxo.amount);
  const send = total / 2n;
  const change = total - send;

  const numOutputs = Buffer.alloc(4);
  numOutputs.writeInt32BE(2, 0);
  const outputsBuf = Buffer.concat([
    numOutputs,
    buildOutput(recipientPem, send).buf,
    buildOutput(nodePubPem, change).buf,
  ]);
  const hashedOut = crypto.createHash('sha256').update(outputsBuf).digest('hex');

  const idxBuf = Buffer.alloc(4);
  idxBuf.writeInt32BE(utxo.index, 0);
  const signBuff = Buffer.concat([
    Buffer.from(utxo.transactionId, 'hex'),
    idxBuf,
    Buffer.from(hashedOut, 'hex'),
  ]);
  const signature = crypto
    .sign('sha256', signBuff, {
      key: nodePrivPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    })
    .toString('hex');

  const infoBefore = await (await fetch(`${BASE}/getNodeInfo`)).json();
  const res = await post('/newTransaction', {
    inputs: [{ transactionId: utxo.transactionId, index: utxo.index, signature }],
    outputs: [
      { recipient: recipientPem, amount: send.toString() },
      { recipient: nodePubPem, amount: change.toString() },
    ],
  });
  assert.strictEqual(res.status, 200, 'a valid transaction must be accepted');

  await new Promise((r) => setTimeout(r, 1200));
  const infoAfter = await (await fetch(`${BASE}/getNodeInfo`)).json();
  assert.ok(
    infoAfter.pendingTransactions > infoBefore.pendingTransactions,
    `valid signed transaction should enter the mempool (${infoBefore.pendingTransactions} -> ${infoAfter.pendingTransactions})`,
  );
});

test('an invalid signature is refused', async (t) => {
  const nodePubPem = readPem('./node_public.pem');
  if (!nodePubPem) return t.skip('node key not present');

  await drainMempool();
  const utxoRes = await post('/getUnusedOutputs', { publicKey: nodePubPem });
  if (utxoRes.status !== 200) return t.skip('node has no funds yet');
  const { unusedOutputs } = await utxoRes.json();
  if (!unusedOutputs?.length) return t.skip('no spendable UTXO');

  const utxo = unusedOutputs[0];
  const attacker = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const before = (await (await fetch(`${BASE}/getNodeInfo`)).json()).pendingTransactions;
  await post('/newTransaction', {
    inputs: [
      {
        transactionId: utxo.transactionId,
        index: utxo.index,
        signature: 'ab'.repeat(256),
      },
    ],
    outputs: [{ recipient: normalize(attacker.publicKey), amount: '1' }],
  });
  await new Promise((r) => setTimeout(r, 1200));
  const after = (await (await fetch(`${BASE}/getNodeInfo`)).json()).pendingTransactions;
  assert.strictEqual(after, before, 'forged signature must never enter the mempool');
});
