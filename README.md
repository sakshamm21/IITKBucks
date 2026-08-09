# ⛁ IITkBucks

**A custom cryptocurrency built on a blockchain model — with a modern web wallet.**

IITkBucks is a fully functional cryptocurrency built from scratch in Node.js. It faithfully implements the core ideas behind industrial blockchains like **Bitcoin and Ethereum**: proof-of-work mining, RSA digital signatures, a UTXO transaction model, and a peer-to-peer network — all with **no central authority**. Because only public keys are needed to transact, the network stays strictly anonymous while remaining verifiable by anyone.

The project ships with **two ways to interact**:

1. **🌐 A modern React web wallet** (in `web/`) — generate keys, register aliases, check balances, and send coins straight from your browser. Private keys never leave your machine.
2. **⌨️ A legacy CLI client** (`frontend.js`) — the original terminal-based interface.

---

## 📑 Table of Contents

- [Features](#-features)
- [How It Works](#-how-it-works)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Using the Web Wallet](#-using-the-web-wallet)
- [How Two Users Transact](#-how-two-users-transact)
- [Using IITKBucks with Friends (Multi-Node)](#-using-iitkbucks-with-friends-multi-node)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [How Transactions Are Signed (For Developers)](#-how-transactions-are-signed-for-developers)
- [Block Format](#-block-format)
- [Troubleshooting](#-troubleshooting)
- [Known Limitations](#-known-limitations)
- [Credits](#-credits)

---

## ✨ Features

- 🔐 **RSA-2048 key pairs** — each user generates their own public/private key pair; the public key *is* the wallet address.
- 🪙 **UTXO model** — balances are tracked as unspent transaction outputs, exactly like Bitcoin.
- ⛏ **Proof-of-work mining** — a worker thread mines new blocks against a SHA-256 difficulty target.
- 🎁 **Coinbase reward** — miners earn **100,000 IITKB** per block plus transaction fees.
- 📡 **Peer-to-peer networking** — independent nodes sync blocks, transactions, and aliases without a central server.
- 👤 **Aliases** — register a human-readable name (e.g. `saksham`) mapped to your public key so friends can find you easily.
- 🖥 **Modern web UI** — Dashboard, Wallet, Aliases, Transfer, and a Block Explorer.

---

## 🧠 How It Works

| Concept | What it means in IITkBucks |
|---|---|
| **Address** | Your RSA public key (PEM format). No personal info needed — that's the anonymity. |
| **Keys** | RSA-2048 pair. Public key = receive address. Private key = signs your transactions (never share it!). |
| **Transaction** | Spends one or more *unspent outputs* (inputs) and creates new outputs for the recipients. Each input is signed by the sender's private key. |
| **UTXO** | An "Unspent Transaction Output" — a chunk of coins owed to a public key. Your balance = sum of all UTXOs addressed to you. |
| **Block** | A batch of transactions plus a header (index, parent hash, body hash, target, timestamp, nonce). |
| **Mining** | Finding a nonce such that `sha256(blockHeader + timestamp + nonce)` is numerically less than the difficulty target. |
| **Blockchain** | A chain of blocks, each referencing the hash of the previous one — tamper-proof by design. |
| **Node** | A copy of this program that stores blocks, accepts transactions, mines, and syncs with peers. |

**Lifecycle of a transaction:**

1. Sender builds a transaction (inputs + outputs) and signs each input with their private key.
2. The transaction is submitted to a node (`POST /newTransaction`).
3. The node verifies it (signatures + coin amounts), adds it to the pending pool, and starts mining it into a block.
4. Once mined, the block is broadcast to all peers, who verify and add it to their chains.
5. The recipient's balance now includes the new UTXO. 🎉

---

## 🛠 Tech Stack

**Backend (Node.js):**
- [Express](https://expressjs.com/) — HTTP API server
- [Node.js `crypto`](https://nodejs.org/api/crypto.html) — RSA keys, SHA-256 hashing, signatures (RSA-PSS)
- [worker_threads](https://nodejs.org/api/worker_threads.html) — mining runs in a parallel thread so the server stays responsive
- Binary block storage (`.dat` files)

**Frontend (Web Wallet in `web/`):**
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — dev server & build tool
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — key generation & transaction signing entirely in the browser (private keys never leave your machine!)

---

## 📁 Project Structure

```
IITkBucks/
├── main.js              # ⭐ The node: Express server + all blockchain logic
├── worker.js            # Mining worker thread (proof-of-work)
├── frontend.js          # Legacy CLI client (readline-based, optional)
├── config.json          # Node configuration (port, URL, peers, mining key)
├── package.json         # Backend dependencies & scripts
├── .gitignore           # Excludes keys, node_modules, and block data
├── blocks/              # Stored blocks as binary files (0.dat, 1.dat, ...)
├── classes/             # Core data structures
│   ├── Transaction.js   #   Transaction (inputs + outputs)
│   ├── Input.js         #   Transaction input (txId, index, signature)
│   ├── Output.js        #   Transaction output (coins, pubkey)
│   └── BlockHead.js     #   Block header
└── web/                 # 🌐 Modern React web wallet
    ├── src/
    │   ├── lib/
    │   │   ├── crypto.ts      # Key generation + transaction signing (browser)
    │   │   ├── api.ts         # Typed API client for the node
    │   │   └── blockchain.ts  # Block binary decoder (for the explorer)
    │   └── pages/             # Dashboard, Wallet, Aliases, Transfer, Explorer
    ├── package.json
    └── vite.config.ts         # Dev server + /api proxy → node port
```

---

## 📋 Prerequisites

- **Node.js 18+** (developed on Node 19; Node 18, 20, or 22 all work. **Node 20+ recommended** for the latest tooling).
- **npm** (comes with Node).
- A browser (Chrome/Edge/Firefox) for the web wallet.
- *(Optional, for multi-node use)* An [ngrok](https://ngrok.com) account to expose your node to the internet.

---

## 🚀 Quick Start

### 1. Start the blockchain node

```bash
# from the project root
npm install
node main.js
```

You'll see the node verifying existing blocks and then:

```
server listening on port 3000
```

> 💡 **First run:** if `config.json` has no `public-key`, the node automatically generates a mining key pair (`node_public.pem` / `node_private.pem`) so block rewards have somewhere to go. Nothing to do manually.

### 2. Start the web wallet (separate terminal)

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. The dev server proxies API calls to the node on port 3000 automatically.

### 3. (Optional) Production build of the wallet

```bash
cd web
npm run build      # outputs to web/dist/
npm run preview    # serve the built app locally
```

---

## 🖥 Using the Web Wallet

The wallet has **5 pages** (sidebar navigation).

### ◈ Dashboard
Shows your node's live status: **block height, pending transaction count, connected peers, registered aliases**, node URL, and a **Mine Block** button (enabled when there are pending transactions).

### ⛁ Wallet
- **Generate Keys** — creates an RSA-2048 pair in your browser and lets you **download `publicKey.pem`** and **`privateKey.pem`**. 🚨 Keep the private key secret — anyone with it can spend your coins!
- **Check Balance** — enter an **alias** or paste/upload a **public key** to see total balance and the individual unspent outputs.

### ◎ Aliases
- **Register Alias** — link a name (e.g. `saksham`) to your public key so friends can send you coins by name.
- **Lookup Alias** — resolve any alias back to its public key (e.g. to send coins to a friend).
- **Registered Aliases** — load the list of aliases known to your node.

### ↗ Transfer
The money-sending page:

1. Paste (or upload) your **public key** and **private key**.
2. Click **💰 Load Balance** — shows your available balance and UTXOs.
3. **Add Recipient(s)** — each recipient can be given *by alias* (click **Resolve**) or *by pasted public key*. Enter the amount in IITKB.
4. Set an optional **transaction fee** (fees incentivize miners to include your transaction).
5. Check the live summary (spending / balance / remaining) and click **↗ Send Transaction**.
6. Your transaction is **signed locally in your browser** and submitted to the node, which mines it into a block.

### ⊞ Explorer
- **Browse Blocks** — enter a block index to see the decoded header (parent hash, body hash, target, nonce, timestamp) and all its transactions, including the 💰 coinbase reward.
- **Pending Transactions** — see transactions waiting to be mined.

---

## 🤝 How Two Users Transact

The simplest setup: both users share **one node** (e.g. you run it and your friend uses your machine, or you both use the same deployed node).

**User A (sender) — e.g. `alice`:**
1. Open the web wallet → **Wallet** → **Generate Keys** → download both `.pem` files.
2. Go to **Aliases** → Register Alias → enter `alice` → paste your public key → **Register**.
3. *(You need some coins first — send yourself a coinbase by mining, or have a friend send you coins.)*

**User B (recipient) — e.g. `bob`:**
1. Generate keys, register the alias `bob` the same way.

**Alice sends coins to Bob:**

1. **Transfer** page → paste Alice's public + private keys → **Load Balance**.
2. Recipient → *By Alias* → type `bob` → **Resolve** (shows ✓ resolved).
3. Enter amount (e.g. `500`) → optional fee → **Send Transaction**.
4. The node verifies, mines, and broadcasts the block. Alice's balance decreases by 500 + fee; Bob's balance increases by 500.

**Bob checks his balance:**
1. **Wallet** → **Check Balance** → *By Alias* → `bob` → shows his new balance. ✅

> 🪙 **Don't have any coins yet?** The first user to mine a block mints **100,000 IITKB** (coinbase). Just submit a transaction (even to yourself) or mine an empty block to start the chain — then send coins to your friends.

---

## 🌐 Using IITKBucks with Friends (Multi-Node)

The real deal: each friend runs their **own node** on their **own machine**, and the nodes connect over the internet in a peer-to-peer network. Transactions and blocks propagate automatically between nodes.

### Setup for each friend

**1. Clone & install**
```bash
git clone <your-repo-url>
cd IITKBucks
npm install
cd web && npm install && cd ..
```

**2. Expose your node to the internet with ngrok**
```bash
# terminal 1 — start your node
node main.js

# terminal 2 — tunnel it
ngrok http 3000
```
ngrok prints a public URL like `https://abc123.ngrok-free.app`.

**3. Edit `config.json`**
```json
{
    "public-key": "./node_public.pem",
    "myurl": "https://abc123.ngrok-free.app",
    "potential_peers": ["https://xyz789.ngrok-free.app"],
    "port": 3000
}
```
- `myurl` → **your** ngrok URL (this is how other nodes reach you).
- `potential_peers` → the ngrok URLs of **your friends' nodes** (comma-separated list).

**4. Restart your node** (`node main.js`). On startup it:
- Tries to connect to each `potential_peer` via `POST /newPeer` (handshake).
- Exchanges peer lists (`GET /getPeers`) to discover more of the network.
- Syncs the blockchain by fetching and verifying every block (`GET /getBlock/:num`).
- Pulls pending transactions (`GET /getPendingTransactions`).

**5. Repeat for every friend** — each friend points `potential_peers` at the others' ngrok URLs.

**6.** Each friend runs the web wallet (`cd web && npm run dev`) and uses the pages normally. **Transactions submitted to any node propagate to all peers**, and the first node to mine the block broadcasts it to everyone — all chains stay in sync. 🎉

### Networking notes

- Each node accepts up to **2 peers** (see `max_peers_length` in `main.js`) — enough for a small friend group.
- Aliases registered on one node are **propagated to peers** automatically (`POST /addAlias` → peers' `/addAlias`).
- If you change your ngrok URL, update `myurl` in your config and tell your friends to update `potential_peers`.
- ngrok's free tier has request limits — fine for small groups, but keep it in mind if you're mining aggressively.

---

## ⚙️ Configuration

`config.json` at the project root:

| Key | Description |
|---|---|
| `public-key` | File path to the node's **mining reward public key** (PEM). Auto-generated as `./node_public.pem` on first run if missing. |
| `myurl` | The node's public URL — `http://localhost:3000` for local use, or your ngrok URL for multi-node use. |
| `potential_peers` | Array of node URLs to connect to on startup (your friends' nodes). |
| `port` | Port the node listens on (default `3000`). |

> If you change the port, also update the proxy target in `web/vite.config.ts`.

---

## 🔌 API Reference

All endpoints live on your node's `myurl` (e.g. `http://localhost:3000`). The web wallet talks to these through the Vite `/api` proxy.

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| `GET` | `/getNodeInfo` | — | Node stats: URL, peers, block height, pending count, aliases. *(Added for the web UI)* |
| `GET` | `/getBlock/:num` | — | Raw binary block `num` (`application/octet-stream`), or `404` if it doesn't exist. |
| `GET` | `/getPendingTransactions` | — | Array of pending transactions `{inputs, outputs}`. |
| `GET` | `/getPeers` | — | `{peers: [...]}` — connected peer URLs. |
| `GET` | `/make` | — | Trigger mining immediately. |
| `POST` | `/newPeer` | `{url}` | Peer handshake — asks this node to add you as a peer (`200` ok / `500` full or duplicate). |
| `POST` | `/newBlock` | raw binary block | Receive a mined block from a peer; verified before acceptance. |
| `POST` | `/newTransaction` | `{inputs, outputs}` | Submit a signed transaction; added to pending pool & mined. |
| `POST` | `/addAlias` | `{alias, publicKey}` | Register `alias → publicKey` (`200` ok / `400` alias taken) and broadcast to peers. |
| `POST` | `/getPublicKey` | `{alias}` | Resolve an alias to its public key (`200` / `404`). |
| `POST` | `/getUnusedOutputs` | `{alias}` **or** `{publicKey}` | Unspent outputs for an address — `{unusedOutputs: [{transactionId, index, amount}]}` (`400` if none found). |

### `newTransaction` payload shape

```json
{
  "inputs": [
    { "transactionId": "<sha256 hex of source tx>", "index": 0, "signature": "<hex signature>" }
  ],
  "outputs": [
    { "recipient": "-----BEGIN PUBLIC KEY-----...", "amount": "500" }
  ]
}
```

---

## 🔏 How Transactions Are Signed (For Developers)

If you want to build your own client, the wire format is:

**1. Build the outputs buffer** (this exact byte layout is what gets hashed):

```
[ numOutputs: 4 bytes big-endian ]
per output:
  [ coins:       8 bytes big-endian (BigInt) ]
  [ pubkey_len:  4 bytes big-endian ]
  [ pubkey:      <pubkey_len> bytes UTF-8 ]
```

**2. Hash it:** `sha256(outputsBuffer)` → hex string.

**3. Sign each input** — the message to sign is:

```
[ transactionId: 32 bytes (hex decoded) ]
[ index:         4 bytes big-endian ]
[ hashedOutput:  32 bytes (hex decoded) ]
```

Signature algorithm: **RSA-PSS, SHA-256, saltLength 32**, with your private key (PKCS#8 PEM). Signature is transmitted as hex.

The web wallet implements this exactly in `web/src/lib/crypto.ts`, so the browser can sign transactions without any server involvement.

---

## 📦 Block Format

Blocks are stored as raw binary files in `blocks/N.dat`:

**Header (116 bytes):**

| Field | Size | Notes |
|---|---|---|
| `index` | 4 bytes | BE int32 |
| `parentHash` | 32 bytes | sha256 of previous block's header |
| `bodyHash` | 32 bytes | sha256 of the block body |
| `target` | 32 bytes | difficulty target (hex string) |
| `timestamp` | 8 bytes | BE uint64 (nanoseconds via `nano-time`) |
| `nonce` | 8 bytes | BE uint64 — the proof-of-work answer |

**Body:** `numTransactions` (4 bytes) + for each transaction: `size` (4 bytes) + transaction bytes. Each transaction follows the input/output layout described above. The first transaction in every block is the **coinbase** (miner reward = 100,000 IITKB + fees).

**Mining:** the worker thread (`worker.js`) searches for a nonce where `sha256(header || timestamp || nonce) < target`. The default target `0000004000...` makes mining fast enough for a college project.

---

## 🛠 Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| `Node Unreachable` in the wallet | Node isn't running (`node main.js`), wrong port, or you changed the port without updating `web/vite.config.ts`. |
| `400 Bad Request` checking balance | The key has **no unspent outputs** on this chain (new key, or coins were spent). The web wallet handles this as a 0-balance. It can also mean the key doesn't match any UTXO — line-ending differences (`\r\n` vs `\n`) are now normalized automatically by the node. |
| `Alias not found` | Aliases are **in-memory** — they vanish when the node restarts. Re-register your alias after a restart (see [Known Limitations](#-known-limitations)). |
| Transaction stuck in pending | Check the Dashboard → **Mine Block** button, or `GET /make`. The node auto-mines on new transactions, but a mining worker can be busy. |
| `peer limit exceeded` | Each node accepts max **2 peers** (`max_peers_length` in `main.js`). |
| Blocks not syncing with friends | Confirm each node's `myurl` is its **public ngrok URL** (not `localhost`), and `potential_peers` lists the friends' URLs. Restart the node after editing `config.json`. |
| Mining reward key error | `config.json` `public-key` must point to an existing PEM file. If missing, delete the key from config and restart — the node regenerates it. |

---

## ⚠️ Known Limitations

- **In-memory state** — aliases and pending transactions are stored in memory only; they reset when the node restarts. Blocks (`blocks/*.dat`) are persisted. If you restart, re-register aliases.
- **Small peer limit** — each node accepts at most 2 peers (`max_peers_length`).
- **Fixed difficulty** — the mining target is constant (no difficulty adjustment like Bitcoin).
- **Educational project** — it implements the concepts faithfully but has **not been security-audited**. Do **not** use it for real money or sensitive data. The original codebase predates modern Node conventions (single-file backend, callback style).
- **ngrok free-tier limits** — enough for a friend group; heavy mining may hit request caps.
- **Keys are client-side** — the web wallet never sends your private key anywhere; keep your `.pem` files safe. Losing the private key = losing the coins. There is no recovery mechanism.

---

## 🏆 Credits

This project began as a freshmen-year summer project under the **Programming Club, Science and Technology Council, IIT Kanpur** — a custom cryptocurrency built on a blockchain model, with contributions to its peer-to-peer networking, mining, and cryptography.

- **Author:** Saksham (original summer project)
- **Mentor:** [Priydarshi Singh](https://github.com/dryairship)
- **Modern web wallet:** React + Vite + TypeScript + Tailwind CSS, built on top of the original node codebase.

---

**Made with 🧡 by the IITK Programming Club — learn, build, and decentralize!**

