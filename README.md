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

---

## How it works

### Mining (proof of work)

Each block header is hashed with SHA-256 and must fall below the network target:

```
0000004000000000000000000000000000000000000000000000000000000000
```

Leading `0x40` means roughly **1 in 67 million** hashes must succeed, so a block
takes about a minute of CPU on a laptop. Mining runs in a `worker_thread`
([worker.js](worker.js)) so the HTTP server stays responsive, and the nonce is
persisted across attempts.

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
| `GET` | `/make` | Mine a block |
| `GET` | `/getPeers` · `/newPeer` | Peer list / add peer |
| `POST` | `/newBlock` | Accept a block from a peer |

---

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Node + web wallet together (development) |
| `npm start` | Node only |
| `npm test` | Run the test suite |
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

Chain data lives in `blocks/*.dat`. Delete it to start from a fresh chain — the node
rebuilds its UTXO set by replaying blocks on boot.

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

**Not yet addressed** — relevant if you expose this beyond localhost:

- No authentication or rate limiting on any endpoint.
- CORS allows all origins (`Access-Control-Allow-Origin: *`).
- `/newPeer` accepts arbitrary URLs (SSRF), and `request` is deprecated.
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
- Add authentication and rate limiting to the node before exposing it to anyone you
  don't trust.

Deployment specifics depend on your hosting, so this repo deliberately stops short
of a one-click setup.

---

## Testing

```bash
npm test
```

Tests run against a live node. Start one first, or let `npm run dev` handle it:

```bash
IITKBUCKS_TEST_PORT=3000 npm test
```

The suite covers alias ownership and replay, path traversal, chain height, an
end-to-end signed transfer, and rejection of a forged signature.

---

## Credits

- **Original backend** — [Priyadharshi Singh](https://github.com/dryairship)
- **Web wallet, security hardening, and tests** — [sakshamm21](https://github.com/sakshamm21)

MIT licensed.
