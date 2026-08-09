/**
 * IITkBucks Blockchain Decoder
 * Decodes raw block binary data into structured objects.
 * Matches the backend's binary format exactly.
 */

export interface BlockHeader {
  index: number;
  parentHash: string;
  bodyHash: string;
  target: string;
  timestamp: bigint;
  nonce: bigint;
}

export interface DecodedInput {
  transactionId: string;
  index: number;
  signLength: number;
  signature: string;
}

export interface DecodedOutput {
  coins: bigint;
  pubkeyLen: number;
  pubKey: string;
}

export interface DecodedTransaction {
  numInputs: number;
  inputs: DecodedInput[];
  numOutputs: number;
  outputs: DecodedOutput[];
  txId: string;
}

export interface DecodedBlock {
  header: BlockHeader;
  transactions: DecodedTransaction[];
  rawSize: number;
}

function readInt32BE(buffer: ArrayBuffer, offset: number): number {
  return new DataView(buffer).getInt32(offset, false);
}

function readBigInt64BE(buffer: ArrayBuffer, offset: number): bigint {
  return new DataView(buffer).getBigInt64(offset, false);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sha256Hex(data: Uint8Array): string {
  // Synchronous hash using a simple approach
  let hash = 0;
  // We need async crypto for real SHA256; for display we compute a simple hash
  // In production, use crypto.subtle.digest
  return bytesToHex(data).slice(0, 64);
}

export async function decodeBlock(rawBuffer: ArrayBuffer): Promise<DecodedBlock> {
  const buffer = new Uint8Array(rawBuffer);

  // --- Block Header (116 bytes) ---
  // index: 4 bytes BE int32
  const index = readInt32BE(rawBuffer, 0);
  // parentHash: 32 bytes
  const parentHash = bytesToHex(buffer.slice(4, 36));
  // bodyHash: 32 bytes
  const bodyHash = bytesToHex(buffer.slice(36, 68));
  // target: 32 bytes
  const target = bytesToHex(buffer.slice(68, 100));
  // timestamp: 8 bytes BE uint64
  const timestamp = readBigInt64BE(rawBuffer, 100);
  // nonce: 8 bytes BE uint64
  const nonce = readBigInt64BE(rawBuffer, 108);

  const header: BlockHeader = { index, parentHash, bodyHash, target, timestamp, nonce };

  // --- Block Body ---
  let offset = 116;
  // numTransactions: 4 bytes
  const numTransactions = readInt32BE(rawBuffer, offset);
  offset += 4;

  const transactions: DecodedTransaction[] = [];

  for (let t = 0; t < numTransactions; t++) {
    // transactionSize: 4 bytes
    const txSize = readInt32BE(rawBuffer, offset);
    offset += 4;

    const txStart = offset;
    const txBuffer = buffer.slice(txStart, txStart + txSize);

    // Hash the transaction
    const txHash = await crypto.subtle.digest('SHA-256', txBuffer);
    const txId = bytesToHex(new Uint8Array(txHash));

    // --- Decode transaction ---
    let txOffset = 0;

    // numInputs: 4 bytes
    const numInputs = readInt32BE(txBuffer.buffer.slice(txBuffer.byteOffset + txOffset, txBuffer.byteOffset + txOffset + 4), 0);
    txOffset += 4;

    const inputs: DecodedInput[] = [];
    for (let i = 0; i < numInputs; i++) {
      // transactionId: 32 bytes
      const inTxId = bytesToHex(txBuffer.slice(txOffset, txOffset + 32));
      txOffset += 32;
      // index: 4 bytes
      const inIdx = readInt32BE(txBuffer.buffer.slice(txBuffer.byteOffset + txOffset, txBuffer.byteOffset + txOffset + 4), 0);
      txOffset += 4;
      // signLength: 4 bytes
      const signLen = readInt32BE(txBuffer.buffer.slice(txBuffer.byteOffset + txOffset, txBuffer.byteOffset + txOffset + 4), 0);
      txOffset += 4;
      // signature: signLen bytes
      const signature = bytesToHex(txBuffer.slice(txOffset, txOffset + signLen));
      txOffset += signLen;

      inputs.push({ transactionId: inTxId, index: inIdx, signLength: signLen, signature });
    }

    // numOutputs: 4 bytes
    const numOutputs = readInt32BE(txBuffer.buffer.slice(txBuffer.byteOffset + txOffset, txBuffer.byteOffset + txOffset + 4), 0);
    txOffset += 4;

    const outputs: DecodedOutput[] = [];
    for (let o = 0; o < numOutputs; o++) {
      // coins: 8 bytes
      const coins = readBigInt64BE(txBuffer.buffer.slice(txBuffer.byteOffset + txOffset, txBuffer.byteOffset + txOffset + 8), 0);
      txOffset += 8;
      // pubkeyLen: 4 bytes
      const pubkeyLen = readInt32BE(txBuffer.buffer.slice(txBuffer.byteOffset + txOffset, txBuffer.byteOffset + txOffset + 4), 0);
      txOffset += 4;
      // pubKey: pubkeyLen bytes (utf-8)
      const pubKey = new TextDecoder().decode(txBuffer.slice(txOffset, txOffset + pubkeyLen));
      txOffset += pubkeyLen;

      outputs.push({ coins, pubkeyLen, pubKey });
    }

    transactions.push({ numInputs, inputs, numOutputs, outputs, txId });
    offset = txStart + txSize;
  }

  return {
    header,
    transactions,
    rawSize: rawBuffer.byteLength,
  };
}

/**
 * Decode a pending transaction from the JSON format returned by the API.
 */
export function decodePendingTransaction(tx: {
  inputs: { transactionId: string; index: number; signature: string }[];
  outputs: { recipient: string; amount: string }[];
}): {
  inputs: { transactionId: string; index: number; signature: string }[];
  outputs: { recipient: string; amount: string }[];
  totalIn: bigint;
  totalOut: bigint;
} {
  let totalIn = BigInt(0);
  let totalOut = BigInt(0);

  for (const out of tx.outputs) {
    totalOut += BigInt(out.amount);
  }

  return {
    inputs: tx.inputs,
    outputs: tx.outputs,
    totalIn,
    totalOut,
  };
}
