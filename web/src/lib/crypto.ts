/**
 * IITkBucks Crypto Library
 * Matches the backend's RSA-PSS SHA256 signing scheme and output buffer format.
 */

// Convert a PEM string to ArrayBuffer for Web Crypto
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [\w\s]+-----/, '')
    .replace(/-----END [\w\s]+-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToPem(buffer: ArrayBuffer, type: 'public' | 'private'): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  const header = type === 'public'
    ? '-----BEGIN PUBLIC KEY-----'
    : '-----BEGIN PRIVATE KEY-----';
  const footer = type === 'public'
    ? '-----END PUBLIC KEY-----'
    : '-----END PRIVATE KEY-----';
  const lines = b64.match(/.{1,64}/g) || [];
  return [header, ...lines, footer].join('\n') + '\n';
}

// Import a PEM private key for signing
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// Import a PEM public key for verification
async function importPublicKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/**
 * Generate an RSA-2048 key pair.
 * Returns PEM-encoded public and private keys as strings.
 */
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const pubSpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: arrayBufferToPem(pubSpki, 'public'),
    privateKey: arrayBufferToPem(privPkcs8, 'private'),
  };
}

/**
 * Build the output buffer exactly as the backend does.
 * Backend outputBuffer(o, outputarray):
 *   numo (4 bytes BE int32)
 *   for each output:
 *     coins (8 bytes BE int64)
 *     pubkey_len (4 bytes BE int32)
 *     pubkey (utf-8 bytes)
 */
export function buildOutputBuffer(
  outputs: { recipient: string; amount: string }[]
): ArrayBuffer {
  const numOutputs = outputs.length;

  // Calculate total size
  let totalSize = 4; // numOutputs
  const pieces: Uint8Array[] = [];

  // numOutputs
  const numBuf = new ArrayBuffer(4);
  new DataView(numBuf).setInt32(0, numOutputs, false);
  pieces.push(new Uint8Array(numBuf));

  for (const out of outputs) {
    // coins (8 bytes, BigInt)
    const coinsBuf = new ArrayBuffer(8);
    new DataView(coinsBuf).setBigInt64(0, BigInt(out.amount), false);
    pieces.push(new Uint8Array(coinsBuf));

    // pubkey
    const pubkeyBytes = new TextEncoder().encode(out.recipient);

    // pubkey_len (4 bytes BE int32)
    const lenBuf = new ArrayBuffer(4);
    new DataView(lenBuf).setInt32(0, pubkeyBytes.length, false);
    pieces.push(new Uint8Array(lenBuf));

    // pubkey data
    pieces.push(pubkeyBytes);

    totalSize += 8 + 4 + pubkeyBytes.length;
  }

  // Concatenate all pieces
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const piece of pieces) {
    result.set(piece, offset);
    offset += piece.length;
  }
  return result.buffer;
}

/**
 * Sign a transaction input.
 * Backend signing:
 *   buf1 = Buffer.from(transId, "hex")
 *   buf2 = Buffer.alloc(4); buf2.writeInt32BE(index, 0)
 *   buf3 = Buffer.from(hashedOutputData, "hex")
 *   signBuff = Buffer.concat([buf1, buf2, buf3])
 *   sign with RSA-PSS, SHA256, saltLength=32
 */
export async function signInput(
  privateKeyPem: string,
  transactionId: string,
  index: number,
  hashedOutputData: string
): Promise<string> {
  const key = await importPrivateKey(privateKeyPem);

  // Build signBuff: transId(hex->bytes) + index(4 bytes BE) + hash(hex->bytes)
  const transIdBytes = hexToBytes(transactionId);
  const indexBuf = new ArrayBuffer(4);
  new DataView(indexBuf).setInt32(0, index, false);
  const hashBytes = hexToBytes(hashedOutputData);

  const signBuff = new Uint8Array(transIdBytes.length + 4 + hashBytes.length);
  signBuff.set(transIdBytes, 0);
  signBuff.set(new Uint8Array(indexBuf), transIdBytes.length);
  signBuff.set(hashBytes, transIdBytes.length + 4);

  const signature = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    key,
    signBuff
  );

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Hash the output buffer with SHA-256 (returns hex).
 * Backend: hashed = crypto.createHash('sha256').update(outputBuff).digest('hex');
 */
export async function hashOutputBuffer(outputBuffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', outputBuffer);
  return bytesToHex(new Uint8Array(hash));
}

// --- Utility functions ---

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Download content as a file in the browser.
 */
export function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/x-pem-file' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read a file as text (for uploading key files).
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
