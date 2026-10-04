import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  generateKeyPair,
  signAliasClaim,
  buildOutputBuffer,
  hashOutputBuffer,
  signInput,
} from '../lib/crypto';
import { addAlias, submitTransaction, getUnusedOutputsByPublicKey, getPublicKey, type UnusedOutput } from '../lib/api';
import { loadWallet, saveWallet, clearWallet, updateWalletAlias, fingerprint, type StoredWallet } from '../lib/wallet';

interface WalletContextValue {
  wallet: StoredWallet | null;
  utxos: UnusedOutput[];
  balance: bigint;
  loadingWallet: boolean;
  loadingBalance: boolean;
  createWallet: () => Promise<void>;
  importWallet: (privateKeyPem: string) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  claimAlias: (alias: string) => Promise<void>;
  resolveAlias: (alias: string) => Promise<string>;
  send: (toAlias: string, amount: bigint) => Promise<{ txCount: number; fee: bigint }>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [utxos, setUtxos] = useState<UnusedOutput[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    setWallet(loadWallet());
    setLoadingWallet(false);
  }, []);

  const refreshBalance = useCallback(async () => {
    const current = wallet ?? loadWallet();
    if (!current) {
      setUtxos([]);
      return;
    }
    setLoadingBalance(true);
    try {
      const { unusedOutputs } = await getUnusedOutputsByPublicKey(current.publicKey);
      setUtxos(unusedOutputs);
    } catch {
      setUtxos([]);
    } finally {
      setLoadingBalance(false);
    }
  }, [wallet]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const createWallet = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const { publicKey, privateKey } = await generateKeyPair();
      const created: StoredWallet = {
        publicKey,
        privateKey,
        alias: null,
        createdAt: Date.now(),
      };
      saveWallet(created);
      setWallet(created);
      await refreshBalance();
    } finally {
      setLoadingWallet(false);
    }
  }, [refreshBalance]);

  const importWallet = useCallback(
    async (privateKeyPem: string) => {
      setLoadingWallet(true);
      try {
        // WebCrypto cannot export the public half from an RSA-PSS private key in
        // all engines, so importing requires the matching public key. We accept a
        // combined PEM blob where the public key is present.
        const hasPublic = /-----BEGIN PUBLIC KEY-----/.test(privateKeyPem);
        if (!hasPublic) {
          throw new Error('Paste both your PRIVATE and PUBLIC key blocks.');
        }
        const pubMatch = privateKeyPem.match(
          /-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/
        );
        const privMatch = privateKeyPem.match(
          /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/
        );
        if (!pubMatch || !privMatch) {
          throw new Error('Could not read both key blocks from that file.');
        }
        const imported: StoredWallet = {
          publicKey: pubMatch[0].replace(/\r\n/g, '\n') + '\n',
          privateKey: privMatch[0].replace(/\r\n/g, '\n') + '\n',
          alias: null,
          createdAt: Date.now(),
        };
        saveWallet(imported);
        setWallet(imported);
        await refreshBalance();
      } finally {
        setLoadingWallet(false);
      }
    },
    [refreshBalance]
  );

  const disconnect = useCallback(() => {
    clearWallet();
    setWallet(null);
    setUtxos([]);
  }, []);

  const claimAlias = useCallback(
    async (alias: string) => {
      const current = wallet ?? loadWallet();
      if (!current) throw new Error('No wallet loaded.');
      // Prove control of the key, otherwise the node refuses the claim.
      const signature = await signAliasClaim(current.privateKey, alias);
      await addAlias(alias, current.publicKey, signature);
      updateWalletAlias(alias);
      setWallet({ ...current, alias });
    },
    [wallet]
  );

  const resolveAlias = useCallback(async (alias: string) => {
    const { publicKey } = await getPublicKey(alias);
    return publicKey;
  }, []);

  const send = useCallback(
    async (toAlias: string, amount: bigint) => {
      const current = wallet ?? loadWallet();
      if (!current) throw new Error('No wallet loaded.');
      if (utxos.length === 0) throw new Error('Nothing to spend — mine or receive first.');

      const recipient = await resolveAlias(toAlias);

      // Select inputs (greedy, oldest first) to cover the amount.
      const sorted = [...utxos].sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));
      const selected: UnusedOutput[] = [];
      let total = 0n;
      for (const u of sorted) {
        selected.push(u);
        total += BigInt(u.amount);
        if (total >= amount) break;
      }
      if (total < amount) throw new Error('Insufficient balance for this amount.');

      const change = total - amount;

      // Build the exact bytes the node hashes and signs over.
      const outputs = [{ recipient, amount: amount.toString() }];
      let outputBuf = buildOutputBuffer(outputs);
      if (change > 0n) {
        outputs.push({ recipient: current.publicKey, amount: change.toString() });
        outputBuf = buildOutputBuffer(outputs);
      }
      const hashedOutput = await hashOutputBuffer(outputBuf);

      const inputs = [];
      for (const u of selected) {
        const signature = await signInput(current.privateKey, u.transactionId, u.index, hashedOutput);
        inputs.push({ transactionId: u.transactionId, index: u.index, signature });
      }

      await submitTransaction(inputs, outputs);
      return { txCount: 1, fee: change };
    },
    [wallet, utxos, resolveAlias]
  );

  const balance = useMemo(() => utxos.reduce((sum, u) => sum + BigInt(u.amount), 0n), [utxos]);

  const value = useMemo<WalletContextValue>(
    () => ({
      wallet,
      utxos,
      balance,
      loadingWallet,
      loadingBalance,
      createWallet,
      importWallet,
      disconnect,
      refreshBalance,
      claimAlias,
      resolveAlias,
      send,
    }),
    [
      wallet,
      utxos,
      balance,
      loadingWallet,
      loadingBalance,
      createWallet,
      importWallet,
      disconnect,
      refreshBalance,
      claimAlias,
      resolveAlias,
      send,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

export { fingerprint };
