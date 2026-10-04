import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  loadApiKey,
  saveApiKey,
  clearApiKey,
  signUp,
  verifyApiKey,
} from './api';

interface AuthContextValue {
  apiKey: string | null;
  checking: boolean;
  createKey: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the API key that gates mining, the faucet and peer management.
 *
 * This is not an account: there is no password and the node stores nothing that could
 * be replayed against a wallet. The key is created once, kept in this browser, and the
 * node keeps only its hash.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const existing = loadApiKey();
    if (!existing) {
      setChecking(false);
      return;
    }
    // Confirm the stored key is still valid rather than trusting it blindly.
    verifyApiKey(existing)
      .then((valid) => {
        if (cancelled) return;
        if (valid) setApiKey(existing);
        else clearApiKey();
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const createKey = useCallback(async () => {
    const key = await signUp();
    saveApiKey(key);
    setApiKey(key);
  }, []);

  const signOut = useCallback(() => {
    clearApiKey();
    setApiKey(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ apiKey, checking, createKey, signOut }),
    [apiKey, checking, createKey, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}