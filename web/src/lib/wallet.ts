/**
 * Wallet persistence.
 *
 * Keys live only in the browser. This module is the single place that reads or
 * writes them, so the storage decision is visible and can be swapped without
 * touching UI code.
 *
 * Note: localStorage is readable by any script on the origin. That is acceptable
 * for a demo, but a production wallet should keep the private key in an
 * IndexedDB-backed CryptoKey or a WebAuthn/OS-keystore wrapper so it is
 * non-extractable. `createWallet` marks keys extractable so the user can back
 * them up as PEM — see README for the production recommendation.
 */

const KEY = 'iitkbucks.wallet.v1';

export interface StoredWallet {
  publicKey: string;
  privateKey: string;
  alias: string | null;
  createdAt: number;
}

export function loadWallet(): StoredWallet | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWallet;
    if (!parsed?.publicKey || !parsed?.privateKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWallet(wallet: StoredWallet): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(wallet));
  } catch {
    // Quota or private-mode failure: the in-memory session still works.
  }
}

export function updateWalletAlias(alias: string | null): void {
  const w = loadWallet();
  if (!w) return;
  saveWallet({ ...w, alias });
}

export function clearWallet(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Short, human-friendly fingerprint of a public key for UI display. */
export function fingerprint(pem: string): string {
  const body = pem
    .replace(/-----BEGIN [\w\s]+-----/, '')
    .replace(/-----END [\w\s]+-----/, '')
    .replace(/\s/g, '');
  const bytes = body.slice(0, 16).toUpperCase();
  return (bytes.match(/.{1,4}/g) || []).join(' ');
}
