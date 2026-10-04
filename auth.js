/**
 * API access keys.
 *
 * Design notes
 * ------------
 * A password would have to be stored on the node, and a node that stores user
 * credentials is a worse thing to hand someone than one that does not. These keys
 * instead gate only the endpoints that cost CPU or move funds, so the node has no
 * notion of an "account" and holds no secret that could be replayed against a
 * wallet. The wallet's own keys remain entirely client-side.
 *
 * Only a SHA-256 hash of each key is persisted, so a leaked key store does not
 * hand over working tokens. Tokens are shown once at creation and never again.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_PREFIX = 'kbx_';
const KEY_STORE = path.join(__dirname, 'blocks', 'apikeys.json');

// Endpoints a caller must authenticate to use. Everything else stays open so the
// wallet UI keeps working before sign-up (reading the chain is public data).
const PROTECTED_PATHS = new Set(['/make', '/faucet', '/newPeer']);

let keys = new Map(); // tokenHash -> { createdAt, lastUsed, calls }
let recentCalls = new Map(); // tokenHash -> [timestamps] for sliding-window limits

function loadKeys() {
  try {
    if (!fs.existsSync(KEY_STORE)) return;
    const raw = fs.readFileSync(KEY_STORE, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    for (const [hash, meta] of Object.entries(parsed)) {
      keys.set(hash, meta);
    }
    if (keys.size) console.log(`loaded ${keys.size} api key(s)`);
  } catch (err) {
    console.log('could not read api key store: ' + err.message);
  }
}

function saveKeys() {
  const payload = {};
  for (const [hash, meta] of keys) payload[hash] = meta;
  const tmp = KEY_STORE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
    fs.renameSync(tmp, KEY_STORE);
  } catch (err) {
    console.log('could not persist api keys: ' + err.message);
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Create a token. The plaintext is returned exactly once and never stored. */
function issueKey() {
  const token = KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
  keys.set(hashToken(token), { createdAt: Date.now(), lastUsed: null, calls: 0 });
  saveKeys();
  return token;
}

function keyCount() {
  return keys.size;
}

/**
 * Look a token up by its digest. The map is keyed by the full SHA-256 hash, so a
 * lookup is a miss unless every byte of the digest matches — there is no
 * prefix to leak incrementally and no shorter secret to guess one character at a
 * time. `crypto.timingSafeEqual` would add nothing here.
 */
function verifyToken(token) {
  if (typeof token !== 'string' || token.length < 16) return null;
  const hash = hashToken(token);
  const meta = keys.get(hash);
  if (!meta) return null;
  return { hash, meta };
}

/** Sliding-window rate limit, keyed per token so one caller cannot starve others. */
function allowCall(hash, windowMs, maxCalls) {
  const now = Date.now();
  const list = (recentCalls.get(hash) || []).filter((t) => now - t < windowMs);
  if (list.length >= maxCalls) {
    recentCalls.set(hash, list);
    return false;
  }
  list.push(now);
    recentCalls.set(hash, list);

    const meta = keys.get(hash);
    if (meta) {
      meta.lastUsed = Date.now();
      meta.calls += 1;
      // Throttle disk writes; persisting on every request would hammer the disk.
      const nowMs = Date.now();
      if (nowMs - (meta._persistedAt || 0) > 60_000) {
        meta._persistedAt = nowMs;
        saveKeys();
      }
    }
    return true;
  }

function isProtected(pathname) {
  return PROTECTED_PATHS.has(pathname);
}

/**
 * Express middleware. Reads a bearer token from the Authorization header, or
 * `x-api-key` for clients that cannot set headers (curl, forms).
 */
function middleware(limits = {}) {
  return function (req, res, next) {
    if (!isProtected(req.path)) return next();

    const header = req.get('authorization') || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const token = bearer || req.get('x-api-key') || '';
    if (!token) {
      return res.status(401).json({
        error: 'missing_api_key',
        message: 'Create an API key to use this endpoint.',
      });
    }

    const found = verifyToken(token);
    if (!found) {
      return res.status(403).json({ error: 'invalid_api_key', message: 'Unknown API key.' });
    }

    const max = limits[req.path]?.max ?? 10;
    const window = limits[req.path]?.windowMs ?? 60_000;
    if (!allowCall(found.hash, window, max)) {
      return res.status(429).json({
        error: 'rate_limited',
        message: `Too many requests. Limit is ${max} per ${Math.round(window / 1000)}s.`,
      });
    }

    req.apiKeyHash = found.hash;
    next();
  };
}

module.exports = {
  issueKey,
  verifyToken,
  keyCount,
  isProtected,
  middleware,
  loadKeys,
  hashToken,
  PROTECTED_PATHS,
};