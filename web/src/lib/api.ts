/**
 * IITkBucks API Client
 * Talks to the node backend.
 * Uses Vite proxy in dev: /api/* -> http://localhost:3000/*
 * In production, configure NODE_URL.
 */

const NODE_URL = '/api';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isBinary = false
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: {} as Record<string, string>,
  };

  if (body !== undefined && !isBinary) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  } else if (body !== undefined && isBinary) {
    opts.body = body as BodyInit;
  }

  const res = await fetch(`${NODE_URL}${path}`, opts);

  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed: ${res.status} ${res.statusText}`);
  }

  if (isBinary) {
    return res.arrayBuffer() as unknown as T;
  }

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
}

export interface PendingTransaction {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
}

// --- API Functions ---

export async function getNodeInfo(): Promise<NodeInfo> {
  return request<NodeInfo>('GET', '/getNodeInfo');
}

export async function getUnusedOutputsByAlias(alias: string): Promise<{ unusedOutputs: UnusedOutput[] }> {
  const res = await fetch(`${NODE_URL}/getUnusedOutputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias }),
  });
  if (res.status === 400) return { unusedOutputs: [] };
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function getUnusedOutputsByPublicKey(publicKey: string): Promise<{ unusedOutputs: UnusedOutput[] }> {
  const res = await fetch(`${NODE_URL}/getUnusedOutputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey }),
  });
  if (res.status === 400) return { unusedOutputs: [] };
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function getPublicKey(alias: string): Promise<{ publicKey: string }> {
  return request<{ publicKey: string }>('POST', '/getPublicKey', { alias });
}

export async function addAlias(alias: string, publicKey: string): Promise<void> {
  const res = await fetch(`${NODE_URL}/addAlias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias, publicKey }),
  });
  if (res.status === 400) throw new Error('Alias already exists');
  if (!res.ok) throw new Error(`Failed to add alias: ${res.status}`);
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

export async function getPeers(): Promise<{ peers: string[] }> {
  return request<{ peers: string[] }>('GET', '/getPeers');
}
