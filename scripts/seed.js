/**
 * Seeds a running node with realistic demo data: several funded wallets, registered
 * aliases, and transfers between them, so the explorer and dashboard show a chain with
 * history instead of a single coinbase transaction.
 *
 * This drives the node's public API exactly as a browser would — every transfer is
 * really signed and really verified — so the resulting history is genuine rather than
 * fabricated rows.
 *
 * Usage:
 *   node scripts/seed.js [--url http://127.0.0.1:3000] [--wallets 4]
 *
 * Proof-of-work takes roughly a minute per block, so seeding is not instant; the
 * script waits for each block and reports progress.
 */
const crypto = require('crypto');

// --- config -----------------------------------------------------------------
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const BASE = arg('url', process.env.IITKBUCKS_NODE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const WALLET_COUNT = Math.max(1, Math.min(8, parseInt(arg('wallets', '4'), 10) || 4));

// Suffix aliases so repeated runs do not collide with names already registered.
const TAG = crypto.randomBytes(3).toString('hex');
const ALIASES = ['ada', 'grace', 'linus', 'barbara', 'radia', 'tim', 'margaret', 'alan'];

// --- api helpers ------------------------------------------------------------
async function call(path, body, apiKey) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    const detail =
      typeof json === 'string' ? json : json?.message || json?.error || 'unknown error';
    throw new Error(`${path} -> ${res.status} ${detail}`);
  }
  return json;
}

async function get(path, apiKey) {
  const res = await fetch(`${BASE}${path}`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

// --- crypto (mirrors web/src/lib/crypto.ts) ---------------------------------
const normalize = (k) => k.toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

function pemToBuf(pem) {
  const b64 = pem
    .replace(/-----BEGIN [\w\s]+-----/, '')
    .replace(/-----END [\w\s]+-----/, '')
    .replace(/\s/g, '');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function importSigningKey(pem) {
  return crypto.webcrypto.subtle.importKey(
    'pkcs8',
    pemToBuf(pem),
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function buildOutputBuffer(outputs) {
  const numOut = Buffer.alloc(4);
  numOut.writeInt32BE(outputs.length, 0);
  const pieces = [numOut];
  for (const o of outputs) {
    const pk = Buffer.from(o.recipient, 'utf8');
    const coins = Buffer.alloc(8);
    coins.writeBigInt64BE(BigInt(o.amount), 0);
    const len = Buffer.alloc(4);
    len.writeInt32BE(pk.length, 0);
    pieces.push(coins, len, pk);
  }
  return Buffer.concat(pieces);
}

async function signInput(privateKeyPem, txId, index, hashedOutput) {
  const key = await importSigningKey(privateKeyPem);
  const idx = Buffer.alloc(4);
  idx.writeInt32BE(index, 0);
  const toSign = Buffer.concat([
    Buffer.from(txId, 'hex'),
    idx,
    Buffer.from(hashedOutput, 'hex'),
  ]);
  const sig = await crypto.webcrypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    key,
    new Uint8Array(toSign)
  );
  return Buffer.from(sig).toString('hex');
}

// --- node interaction -------------------------------------------------------
/**
 * Waits for the chain to reach `target`.
 *
 * The timeout has to be generous. Proof of work is an exponential wait, not a fixed one:
 * the target asks for roughly one hash in 67 million, which at a few hundred thousand
 * hashes per second averages about two and a half minutes per block, but the distribution
 * has a long tail and an unlucky run can go far longer. Timing out near the mean made
 * seeding fail intermittently even when the node was mining perfectly well.
 */
async function waitForHeight(target, apiKey, timeoutMs = 900_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = await get('/getNodeInfo', apiKey);
    if (info.blockIndex >= target) return info;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('timed out waiting for the node to mine a block');
}

/**
 * Mine one block and wait for it.
 *
 * `/make` is a GET route, so it cannot go through the JSON `call` helper — posting to it
 * returns 404 and no block is ever searched for. The node also answers `queued` when a
 * search is already running; that is not a failure, the height still has to advance.
 */
async function mineAndWait(apiKey, before) {
  const res = await fetch(`${BASE}/make`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/make -> ${res.status} ${body.slice(0, 200)}`);
  }
  try {
    return await waitForHeight(before + 1, apiKey);
  } catch (err) {
    throw new Error(`/make was accepted but no block appeared within 900s (${err.message})`);
  }
}

/**
 * Signs and submits a spend from one wallet to another. Returns false when the sender
 * has nothing spendable.
 */
async function transfer(from, toAlias, amount, apiKey) {
  const { unusedOutputs } = await call('/getUnusedOutputs', { publicKey: from.publicKey });
  if (!unusedOutputs || unusedOutputs.length === 0) return false;

  const sorted = [...unusedOutputs].sort((a, b) => (BigInt(a.amount) < BigInt(b.amount) ? 1 : -1));
  const selected = [];
  let total = 0n;
  for (const u of sorted) {
    selected.push(u);
    total += BigInt(u.amount);
    if (total >= BigInt(amount)) break;
  }
  if (total < BigInt(amount)) return false;

  const recipient = await call('/getPublicKey', { alias: toAlias });
  const outputs = [{ recipient: recipient.publicKey, amount: String(amount) }];
  const change = total - BigInt(amount);
  if (change > 0n) outputs.push({ recipient: from.publicKey, amount: change.toString() });

  const hashedOutput = crypto.createHash('sha256').update(buildOutputBuffer(outputs)).digest('hex');

  const inputs = [];
  for (const u of selected) {
    inputs.push({
      transactionId: u.transactionId,
      index: u.index,
      signature: await signInput(from.privateKey, u.transactionId, u.index, hashedOutput),
    });
  }

  await call('/newTransaction', { inputs, outputs }, apiKey);
  return true;
}

// --- main -------------------------------------------------------------------
(async () => {
  console.log(`Seeding ${BASE}\n`);

  let apiKey;
  try {
    const signup = await call('/signup', {});
    apiKey = signup.apiKey;
    console.log('created a temporary API key for seeding');
  } catch (err) {
    console.log(`could not sign up (${err.message}); continuing without a key`);
  }

  const wallets = [];
  for (let i = 0; i < WALLET_COUNT; i++) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    wallets.push({
      alias: `${ALIASES[i % ALIASES.length]}${TAG}`.slice(0, 31),
      publicKey: normalize(publicKey),
      privateKey: normalize(privateKey),
      funded: false,
    });
  }

  console.log('wallets:', wallets.map((w) => `@${w.alias}`).join(', '));

  console.log('\nregistering aliases...');
  for (const w of wallets) {
    const challenge = `IITKBUCKS-ALIAS:${Buffer.byteLength(w.alias, 'utf8')}:${w.alias}`;
    const signature = crypto
      .sign('sha256', Buffer.from(challenge, 'ascii'), {
        key: w.privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      })
      .toString('hex');
    try {
      await call('/addAlias', { alias: w.alias, publicKey: w.publicKey, signature }, apiKey);
      console.log(`  @${w.alias} registered`);
    } catch (err) {
      console.log(`  @${w.alias} skipped (${err.message})`);
    }
  }

  console.log('\nfunding wallets...');
  let info = await get('/getNodeInfo', apiKey);
    if (info.blockIndex === 0) {
      console.log('  chain is empty, mining the first block so the node has funds...');
      info = await mineAndWait(apiKey, 0);
    }

  for (const w of wallets) {
    try {
      const res = await call('/faucet', { publicKey: w.publicKey }, apiKey);
      w.funded = true;
      console.log(`  @${w.alias} received ${res.granted} KBX`);
    } catch (err) {
      console.log(`  @${w.alias} not funded (${err.message})`);
      continue;
    }
    // Wait for the payout to be mined before requesting the next one: the node only
    // funds from UTXOs it still holds, so back-to-back requests run out immediately.
    const before = (await get('/getNodeInfo', apiKey)).blockIndex;
    await mineAndWait(apiKey, before);
  }

  console.log('\ntransferring between wallets...');
    // Clamped to the wallets that actually exist, so --wallets 1 or 2 does not
    // silently skip every transfer that points past the end of the list.
    const transfers = [
      { from: 0, to: 1, amount: 1200 },
      { from: 1, to: 2, amount: 400 },
      { from: 2, to: 0, amount: 150 },
      { from: 3, to: 1, amount: 900 },
      { from: 0, to: 3, amount: 75 },
    ].filter((t) => t.from < wallets.length && t.to < wallets.length);

  for (const t of transfers) {
    const from = wallets[t.from];
    const to = wallets[t.to];
    if (!from?.funded || !to?.funded) continue;
    const before = (await get('/getNodeInfo', apiKey)).blockIndex;
    try {
      const ok = await transfer(from, to.alias, t.amount, apiKey);
      if (!ok) {
        console.log(`  @${from.alias} -> @${to.alias}: insufficient funds`);
        continue;
      }
      await mineAndWait(apiKey, before);
      console.log(`  @${from.alias} -> @${to.alias}: ${t.amount} KBX`);
    } catch (err) {
      console.log(`  @${from.alias} -> @${to.alias}: failed (${err.message})`);
    }
  }

  const final = await get('/getNodeInfo', apiKey);
  console.log(`\ndone. chain height ${final.blockIndex}, ${final.aliases.length} aliases.`);

  console.log('\nBalances:');
  for (const w of wallets) {
    try {
      const { unusedOutputs } = await call('/getUnusedOutputs', { alias: w.alias });
      const total = (unusedOutputs || []).reduce((s, u) => s + BigInt(u.amount), 0n);
      console.log(`  @${w.alias}: ${total} KBX`);
    } catch {
      console.log(`  @${w.alias}: unavailable`);
    }
  }
})().catch((err) => {
  console.error(`\nseeding failed: ${err.message}`);
  process.exit(1);
});