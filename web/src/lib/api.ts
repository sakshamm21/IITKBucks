/**
 * IITkBucks API client.
 *
 * In development Vite proxies /api -> the local node. In production the node lives
 * on a remote host, so the base URL comes from VITE_API_URL at build time. Keeping
 * one client with a single source of truth avoids the "works locally, broken on
 * Vercel" class of bug.
 */

const NODE_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/$/,
  ''
) || '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the node could not be reached at all. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** True when the caller needs to create or re-enter an API key. */
  get needsAuth(): boolean {
    return this.status === 401;
  }
}

const API_KEY_STORAGE = 'iitkbucks.apikey.v1';

export function loadApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function saveApiKey(key: string): void {
  try {
    localStorage.setItem(API_KEY_STORAGE, key);
  } catch {
    /* storage unavailable */
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

/** Create an API key on the node. The token is returned exactly once. */
export async function signUp(): Promise<string> {
  const res = await request<{ apiKey: string }>('POST', '/signup', {});
  saveApiKey(res.apiKey);
  return res.apiKey;
}

/** Confirm the stored key is still recognised by the node. */
export async function verifyApiKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${NODE_URL}/verifyKey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: '{}',
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isBinary = false
): Promise<T> {
  const opts: RequestInit = { method, headers: {} as Record<string, string> };

  const key = loadApiKey();
  if (key) (opts.headers as Record<string, string>).Authorization = `Bearer ${key}`;

  if (body !== undefined && !isBinary) {
    opts.headers = { ...(opts.headers as Record<string, string>), 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  } else if (body !== undefined && isBinary) {
    opts.body = body as BodyInit;
  }

  let res: Response;
  try {
    res = await fetch(`${NODE_URL}${path}`, opts);
  } catch {
    throw new ApiError(
      'Cannot reach the IITkBucks node. It may be starting up or offline.',
      0
    );
  }

  if (!res.ok) {
    let code: string | undefined;
    let message = `${method} ${path} failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) code = body.error;
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status, code);
  }

  if (isBinary) return res.arrayBuffer() as unknown as T;

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// --- Types ---

export interface UnusedOutput {
  transactionId: string;
  index: number;
  amount: string;
}

export interface TransactionInput {
  transactionId: string;
  index: number;
  signature: string;
}

export interface TransactionOutput {
  recipient: string;
  amount: string;
}

export interface NodeInfo {
  myurl: string;
  peers: string[];
  blockIndex: number;
  pendingTransactions: number;
  aliases: string[];
  /** Present on hardened nodes; absent on older builds. */
  apiKeys?: number;
  requiresAuth?: boolean;
}

export interface PendingTransaction {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
}

// --- API functions ---

export async function getNodeInfo(): Promise<NodeInfo> {
  return request<NodeInfo>('GET', '/getNodeInfo');
}

export async function getUnusedOutputsByAlias(
  alias: string
): Promise<{ unusedOutputs: UnusedOutput[] }> {
  try {
    return await request<{ unusedOutputs: UnusedOutput[] }>('POST', '/getUnusedOutputs', { alias });
  } catch (e) {
    // An unknown alias or a key with no funds is a normal state, not an error.
    if (e instanceof ApiError && e.status === 400) return { unusedOutputs: [] };
    throw e;
  }
}

export async function getUnusedOutputsByPublicKey(
  publicKey: string
): Promise<{ unusedOutputs: UnusedOutput[] }> {
  try {
    return await request<{ unusedOutputs: UnusedOutput[] }>('POST', '/getUnusedOutputs', { publicKey });
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) return { unusedOutputs: [] };
    throw e;
  }
}

export async function getPublicKey(alias: string): Promise<{ publicKey: string }> {
  return request<{ publicKey: string }>('POST', '/getPublicKey', { alias });
}

/**
 * Claim an alias. The node requires a signature proving control of `publicKey`,
 * otherwise the claim is refused — this stops anyone reserving a name that others
 * intend to send funds to.
 */
export async function addAlias(
  alias: string,
  publicKey: string,
  signature: string
): Promise<void> {
  try {
    await request('POST', '/addAlias', { alias, publicKey, signature });
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      throw new ApiError('That alias is already taken.', 400);
    }
    if (e instanceof ApiError && e.status === 403) {
      throw new ApiError('Could not verify ownership of that key for this alias.', 403);
    }
    throw e;
  }
}

export async function submitTransaction(
  inputs: TransactionInput[],
  outputs: TransactionOutput[]
): Promise<void> {
  await request('POST', '/newTransaction', { inputs, outputs });
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  return request<PendingTransaction[]>('GET', '/getPendingTransactions');
}

export async function getBlock(index: number): Promise<ArrayBuffer> {
  return request<ArrayBuffer>('GET', `/getBlock/${index}`, undefined, true);
}

export async function triggerMine(): Promise<void> {
  await request('GET', '/make');
}

/**
 * Claim demo funds for a public key. Requires an API key and is capped per wallet by
 * the node. Returns the amount granted.
 */
export async function requestFaucet(publicKey: string): Promise<{
  granted: string;
  total: string;
  limit: string;
}> {
  return request('POST', '/faucet', { publicKey });
}

export async function getPeers(): Promise<{ peers: string[] }> {
  return request<{ peers: string[] }>('GET', '/getPeers');
}

/** Resolve a block that may not exist yet without throwing. */
export async function tryGetBlock(index: number): Promise<ArrayBuffer | null> {
  try {
    return await getBlock(index);
  } catch {
    return null;
  }
}

export const API_BASE = NODE_URL;
