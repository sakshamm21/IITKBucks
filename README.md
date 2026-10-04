# IITkBucks

A cryptocurrency built from scratch in Node.js — proof-of-work mining, RSA-PSS
digital signatures, and a UTXO transaction model, with a React wallet in the browser.

Everything runs on your own machine. There is no hosted instance and nothing is
teleported anywhere: your keys are generated in the browser and your private key
never leaves it.

> **Educational project.** It has not been security-audited. Do not use it for real
> money. See [Security status](#security-status) for what is and isn't covered.

---

## Quick start

Requires **Node.js 18+**.

```bash
git clone https://github.com/sakshamm21/IITKBucks.git
cd IITKBucks
npm install
npm run install:web
npm run dev
```

Then open **http://localhost:5173**.

`npm run dev` starts both the blockchain node and the web wallet and wires them
together. If port 3000 is taken, pick another:

```bash
IITKBUCKS_DEV_PORT=3200 npm run dev        # macOS / Linux
$env:IITKBUCKS_DEV_PORT=3200; npm run dev  # Windows PowerShell
```

### First run

The node generates its own mining key pair on startup (`node_public.pem` /
`node_private.pem`) so block rewards have somewhere to go. Nothing to configure.

On the first launch the chain is empty — go to **Mine** and mine a block to create
the genesis history, then **Identity** to claim an alias, then **Send** to spend.

### Demo data (optional)

An empty chain makes for a poor demo. `npm run seed` creates several funded
wallets, registers their aliases, and moves coins between them, so the dashboard
and explorer show real history:

```bash
npm run seed                 # 4 wallets against http://127.0.0.1:3000
npm run seed -- --wallets 6  # more wallets
npm run seed -- --url http://127.0.0.1:3200   # a node on another port
```

Every transfer is signed and verified by the node exactly as a browser would send
it, so the resulting history is genuine rather than fabricated rows. Proof of work
costs about a minute per block, so expect this to take several minutes. Each
seeded wallet's alias and balance are printed when it finishes.

The seed script deliberately does **not** write the generated private keys
anywhere. Seeding gives you history to look at; to actually spend from one of those
wallets, create a wallet in the browser and use the test faucet instead.

---

## How it works

### Mining (proof of work)

Each block header is hashed with SHA-256 and must fall below the network target:

```
0000004000000000000000000000000000000000000000000000000000000000
```

Leading `0x40` means roughly **1 in 67 million** hashes must succeed, so a block
takes a couple of minutes of CPU on a typical laptop. Mining runs in a `worker_thread`
([worker.js](worker.js)) so the HTTP server stays responsive, and the nonce is
persisted across attempts.

Two details matter if you change the miner:

- **One search at a time.** The worker hashes a single header until it wins, so
  `makeBlock` refuses to start another while one is running and defers the request
  instead. Requests arriving in a burst are merged, not queued — otherwise the Nth
  caller waits N blocks and times out.
- **The search loop allocates nothing per attempt.** It builds the fixed 100-byte
  prefix once and writes the 16 varying bytes into a reused buffer. The naive version
  allocated a `Buffer.concat` per hash, and at ~67 million hashes per block the garbage
  outran the collector and killed the node with a heap exhaustion. Reusing the buffer
  also made it roughly 1.7× faster.

### Transactions (UTXO)

There are no account balances. Coins live in **unspent transaction outputs**, and
spending means consuming a previous output and creating new ones:

```
sum(inputs)  >=  sum(outputs)
     │
     └─ the difference is the miner fee
```

Each input is signed over `txId ‖ index ‖ SHA-256(outputs)` with RSA-PSS/SHA-256.
Outputs are keyed `txId:index` in a `Map`, rebuilt by replaying every block at
startup.

### Keys

RSA-2048. The wallet generates a key pair with the browser's Web Crypto API and
signs transactions locally. The node only ever sees public keys and signatures.

### Aliases

A human-readable name (`@satoshi`) mapped to a public key. Claiming one requires
signing a domain-separated challenge, so nobody can reserve a name that others
intend to send funds to. Aliases persist to `blocks/aliases.json`.

---

## Project layout

```
main.js        Blockchain node: HTTP API, validation, mining, P2P
worker.js      Proof-of-work miner (worker_thread)
dev.js         Starts the node and web wallet together
classes/       Transaction, Input, Output, BlockHead
config.json    Node port, URL, mining key, peers
test/          Security and transfer regression tests
web/           React + Vite + TypeScript wallet
```

### Backend API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/getNodeInfo` | Chain height, peers, mempool size, aliases |
| `GET` | `/getBlock/:num` | Raw block bytes (binary) |
| `GET` | `/getPendingTransactions` | Mempool contents |
| `POST` | `/newTransaction` | Submit a signed transaction |
| `POST` | `/getUnusedOutputs` | Spendable outputs by alias or public key |
| `POST` | `/getPublicKey` | Resolve an alias to a public key |
| `POST` | `/addAlias` | Claim an alias (requires ownership proof) |
| `POST` | `/signup` | Issue an API key |
| `POST` | `/faucet` | Request test coins (rate limited) |
| `GET` | `/make` | Mine a block — **requires an API key** |
| `GET` | `/getPeers` · `/newPeer` | Peer list / add peer — `/newPeer` **requires an API key** |
| `POST` | `/newBlock` | Accept a block from a peer |

### Access keys

The endpoints that burn CPU or move funds (`/make`, `/faucet`, `/newPeer`) need an
API key. Everything else stays open, because reading a public chain is public.

```bash
curl -X POST http://127.0.0.1:3000/signup
# { "apiKey": "kbx_...", ... }

curl -X POST http://127.0.0.1:3000/faucet \
  -H "Authorization: Bearer kbx_..." \
  -H "Content-Type: application/json" \
  -d '{"publicKey":"-----BEGIN PUBLIC KEY-----\n..."}'
```

These are **not** user accounts. There is no login, no password, and no profile:
the node stores only a SHA-256 hash of each key, so it holds nothing that could be
replayed against a wallet or phished back from a stolen key store. A key is shown
once when created and is not recoverable afterwards. Clear them by deleting
`blocks/apikeys.json`.

---

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Node + web wallet together (development) |
| `npm start` | Node only |
| `npm test` | Run the test suite |
| `npm run seed` | Populate a running node with demo wallets and history |
| `npm run build:web` | Production build of the wallet |
| `npm run install:web` | Install wallet dependencies |

---

## Configuration

`config.json`:

| Key | Meaning |
| --- | --- |
| `port` | Port the node listens on |
| `myurl` | Public URL other peers use to reach this node |
| `public-key` | Mining reward key (auto-generated if missing) |
| `potential_peers` | Seed peers to sync from |

Environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `IITKBUCKS_PORT` | `config.json` | Override the listening port without editing the file |
| `IITKBUCKS_DEV_PORT` | `3000` | Port used by `npm run dev` when 3000 is taken |
| `IITKBUCKS_CORS_ORIGINS` | local Vite origins | Comma-separated CORS allowlist |
| `IITKBUCKS_ALLOW_LOCAL_PEERS` | `false` | Permit peers on loopback/private addresses |
| `IITKBUCKS_NODE_URL` | `http://127.0.0.1:3000` | Node the seed script targets |
| `IITKBUCKS_TEST_PORT` | `3100` | Node the test suite targets |
| `VITE_API_URL` | `/api` (proxied) | Node URL the built wallet talks to |

Chain data lives in `blocks/*.dat`. Delete it to start from a fresh chain — the node
rebuilds its UTXO set by replaying blocks on boot. Registered aliases
(`blocks/aliases.json`) and API keys (`blocks/apikeys.json`) live there too.

---

## Security status

**Fixed** in the current version, each covered by a regression test:

| Issue | Impact |
| --- | --- |
| Unverified mempool admission | `/newTransaction` accepted transactions without checking signatures; forgeries only got caught later, if they fit the block size budget. Both this and the peer import path now verify first. |
| Alias squatting | Any unused alias could be claimed without proving ownership of the key, silently intercepting funds sent to it. Now requires a signature over a length-prefixed challenge, so a proof cannot be replayed to another name. |
| Double-spend within one transaction | The same UTXO could be listed as two inputs and be debited twice. |
| Ambiguous UTXO keys | `[txId, index].toString()` collided on digit boundaries; now `txId:index`. |
| Coinbase consensus split | The reward check used `<=`, so locally-mined blocks skipped validation while the same block from a peer was rejected — nodes could disagree about the same block. |
| Chain height off-by-one | The node advertised a height whose block did not exist. |
| Aliases lost on restart | Aliases were in-memory only, so a restart orphaned funds sent to registered names. |
| Leaked message listeners | `makeBlock` registered a new worker listener on every call without removing the old one, so one mined block fired every handler ever registered — each incrementing the chain height. Beyond the wrong height, the retained block buffers grew until the node ran out of heap and aborted. |
| Unbounded rollback set | The spent-UTXO rollback map cleared entries with `delete entry.value` instead of `entry.delete()`, so it never shrank and leaked one entry per spent input. |
| Allocation per proof-of-work hash | The miner allocated a fresh buffer and two BigInts on every one of ~67 million attempts per block. The node died of heap exhaustion after a handful of blocks; reusing one buffer fixed it and made mining ~1.7× faster. |
| Concurrent mine requests | `/make` queued one proof-of-work search per request on a single worker, so the Nth request waited N blocks and timed out. Requests are now merged into the search already running, and `/make` reports whether it started or deferred. |
| Faucet double-spend | Outputs are only consumed once mined, so two faucet requests arriving in the same window could spend the same output. Reserved outputs are now tracked until mined. |
| SSRF via `/newPeer` | The node would fetch whatever URL it was given, including loopback and link-local addresses (the cloud metadata endpoint). Peer URLs are now validated and must be public HTTP(S), and `/newPeer` requires an API key. |

**Not yet addressed** — relevant if you expose this beyond localhost:

- Access keys gate the expensive endpoints but there is no user model: anyone who
  can reach the node can sign up and mine, transfer, or drain the faucet.
- CORS defaults to the local Vite origins only. Any request carrying an `Origin`
  outside `IITKBUCKS_CORS_ORIGINS` is refused, so the node is not reachable from a
  page you happen to be visiting — but a request with no `Origin` (curl, a native
  app) still passes, which is what makes it scriptable.
- Peer URLs are checked for private ranges but not resolved through DNS, so a
  hostname that resolves to a private address would still pass.
- Wallet keys are stored in `localStorage`, readable by any script on the origin. A
  production wallet should keep keys non-extractable (IndexedDB/`CryptoKey`).

Treat this as a local development tool, not a public service.

---

## Running it as a service (optional)

This project is designed to run locally. If you want it reachable, the node needs a
**persistent filesystem and uninterrupted CPU** — the chain lives in `blocks/` and
proof-of-work cannot finish inside a short-lived serverless invocation. So:

- **Don't deploy the node to Vercel or similar serverless platforms.** Functions time
  out long before a block is found, and the filesystem is wiped between invocations.
- Use a small always-on VM or container with a mounted volume.
- The web wallet can be hosted anywhere static; set `VITE_API_URL` to the node's URL
  at build time and serve it over HTTPS.
- Add a user model before exposing it to anyone you don't trust. Access keys stop
  drive-by abuse; they are not accounts and they are not a substitute for one.

Deployment specifics depend on your hosting, so this repo deliberately stops short
of a one-click setup.

---

## Testing

```bash
npm test
```

The suite covers alias ownership and replay, path traversal, chain height, an
end-to-end signed transfer, and rejection of a forged signature. It needs a node
running on `IITKBUCKS_TEST_PORT` (default `3100`):

```bash
IITKBUCKS_PORT=3100 npm start      # in one terminal
npm test                           # in another
```

---

## Credits

- **Original backend** — [Priyadharshi Singh](https://github.com/dryairship)
- **Web wallet, security hardening, and tests** — [sakshamm21](https://github.com/sakshamm21)

MIT licensed.
