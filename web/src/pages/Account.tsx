import { useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { useWallet } from '../lib/useWallet';
import { useNodeStatus } from '../lib/useNodeStatus';
import { Card, SectionTitle, Badge, ErrorState, CopyButton } from '../components/ui';
import { requestFaucet, ApiError } from '../lib/api';
import { formatCoins } from '../lib/format';
import { KeyRound, Droplets, CheckCircle2, LogOut } from 'lucide-react';

export default function Account() {
  const { apiKey, checking, createKey, signOut } = useAuth();
  const { wallet, refreshBalance } = useWallet();
  const { info, refresh } = useNodeStatus();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faucet, setFaucet] = useState<{ granted: string; limit: string } | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await createKey();
    } catch {
      setError('Could not reach the node. Is it running?');
    } finally {
      setBusy(false);
    }
  }

  async function handleFaucet() {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    setFaucet(null);
    try {
      const res = await requestFaucet(wallet.publicKey);
      setFaucet(res);
      // The transfer enters the mempool; re-read once the node has had time to work.
      setTimeout(() => {
        void refreshBalance();
        void refresh();
      }, 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the faucet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
      <Card>
        <SectionTitle
          eyebrow="Access"
          title="API key"
          action={
            checking ? undefined : apiKey ? (
              <Badge tone="positive">active</Badge>
            ) : (
              <Badge tone="warning">not created</Badge>
            )
          }
        />

        <div className="space-y-5">
          <div className="flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <KeyRound size={18} className="mt-0.5 shrink-0 text-iris-300" />
            <p className="text-sm leading-relaxed text-white/55">
              A random token stored only in this browser. It is not an account — there is
              no password, and the node keeps only a hash of it so it cannot be replayed
              against a wallet. It gates mining, the faucet and peer management.
            </p>
          </div>

          {error && <ErrorState message={error} />}

          {checking ? (
            <div className="skeleton h-11 w-full" />
          ) : apiKey ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-mint-500/20 bg-mint-500/[0.07] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="eyebrow">Your key</span>
                  <CopyButton value={apiKey} label="Copy" />
                </div>
                <code className="block break-all font-mono text-xs leading-relaxed text-white/60">
                  {apiKey}
                </code>
              </div>
              <button onClick={signOut} className="btn-ghost">
                <LogOut size={16} /> Forget this key
              </button>
            </div>
          ) : (
            <button onClick={handleCreate} disabled={busy} className="btn-primary w-full">
              <KeyRound size={16} />
              {busy ? 'Creating…' : 'Create API key'}
            </button>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle eyebrow="Demo funds" title="Faucet" />

        {!wallet ? (
          <p className="text-sm text-white/45">
            Create a wallet first — the faucet pays out to a public key.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <Droplets size={18} className="mt-0.5 shrink-0 text-mint-300" />
              <p className="text-sm leading-relaxed text-white/55">
                Mining pays the node, not your browser wallet. The faucet sends a small
                amount to your key so you can try a transfer straight away. It is capped
                per wallet and rate limited.
              </p>
            </div>

            {faucet && (
              <div className="flex items-start gap-3 rounded-2xl border border-mint-500/25 bg-mint-500/[0.07] px-4 py-3">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-mint-300" />
                <p className="text-sm text-mint-200">
                  Sent {formatCoins(faucet.granted)} KBX to your wallet. It will appear in
                  your balance once the transaction is mined.
                </p>
              </div>
            )}

            <button
              onClick={handleFaucet}
              disabled={busy || !apiKey}
              className="btn-primary w-full"
            >
              <Droplets size={16} />
              {busy ? 'Requesting…' : 'Request demo funds'}
            </button>
            {!apiKey && (
              <p className="text-center text-xs text-white/35">
                Create an API key above to use the faucet.
              </p>
            )}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle eyebrow="Node" title="This node" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="eyebrow mb-1">Height</div>
            <div className="nums font-display text-xl font-semibold text-white">
              {info?.blockIndex ?? '—'}
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1">Aliases</div>
            <div className="nums font-display text-xl font-semibold text-white">
              {info?.aliases.length ?? '—'}
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1">API keys</div>
            <div className="nums font-display text-xl font-semibold text-white">
              {info?.apiKeys ?? '—'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}