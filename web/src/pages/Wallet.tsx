import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../lib/useWallet';
import { Card, SectionTitle, Badge, ErrorState, CopyButton, Stat } from '../components/ui';
import { downloadFile } from '../lib/crypto';
import { fingerprint } from '../lib/wallet';
import { formatCoins } from '../lib/format';
import { Wallet as WalletIcon, Download, LogOut, ShieldCheck, KeyRound, AlertTriangle } from 'lucide-react';

export default function WalletPage() {
  const { wallet, balance, utxos, createWallet, importWallet, disconnect, loadingWallet } = useWallet();
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await createWallet();
    } catch {
      setError('Could not generate a key pair in this browser.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      await importWallet(importText);
      setShowImport(false);
      setImportText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function handleBackup() {
    if (!wallet) return;
    // Both halves are needed to restore the wallet, so they are written together.
    downloadFile(
      `iitkbucks-wallet-${Date.now()}.pem`,
      `${wallet.privateKey}\n${wallet.publicKey}`
    );
  }

  if (!wallet) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
        <Card>
          <SectionTitle eyebrow="Wallet" title="Your keys, your coins" />

          {!showImport ? (
            <div className="space-y-5">
              <div className="flex items-start gap-4 rounded-2xl border border-iris-500/20 bg-iris-500/[0.07] p-5">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-iris-300" />
                <p className="text-sm leading-relaxed text-white/60">
                  Your RSA-2048 key pair is generated with the browser&rsquo;s Web Crypto API.
                  The private key is stored only in this browser and is never transmitted.
                  Anyone with it can spend your coins, so back it up somewhere safe.
                </p>
              </div>

              {error && <ErrorState message={error} />}

              <div className="flex flex-wrap gap-3">
                <button onClick={handleCreate} disabled={busy || loadingWallet} className="btn-primary">
                  <WalletIcon size={16} />
                  {busy ? 'Generating…' : 'Create new wallet'}
                </button>
                <button onClick={() => setShowImport(true)} className="btn-secondary">
                  <KeyRound size={16} /> Import existing
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-white/50">
                Paste your backup file contents. It must contain both the{' '}
                <span className="font-mono text-white/70">PRIVATE KEY</span> and{' '}
                <span className="font-mono text-white/70">PUBLIC KEY</span> blocks.
              </p>
              {error && <ErrorState message={error} />}
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={9}
                spellCheck={false}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                className="input resize-none !text-xs leading-relaxed"
              />
              <div className="flex flex-wrap gap-3">
                <button onClick={handleImport} disabled={busy || !importText.trim()} className="btn-primary">
                  {busy ? 'Importing…' : 'Import wallet'}
                </button>
                <button onClick={() => setShowImport(false)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-up">
      <Card>
        <SectionTitle
          eyebrow="Your wallet"
          title="Wallet details"
          action={wallet.alias ? <Badge tone="positive">@{wallet.alias}</Badge> : <Badge tone="warning">No alias yet</Badge>}
        />

        <div className="mb-6 grid gap-5 sm:grid-cols-3">
          <Stat label="Balance" value={formatCoins(balance)} hint="KBX spendable" tone="positive" />
          <Stat label="UTXOs" value={utxos.length} hint="unspent outputs" />
          <Stat
            label="Created"
            value={new Date(wallet.createdAt).toLocaleDateString()}
            hint="in this browser"
          />
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="eyebrow">Public key fingerprint</span>
              <CopyButton value={fingerprint(wallet.publicKey)} label="Copy" />
            </div>
            <div className="break-all font-mono text-xs leading-relaxed text-white/60">
              {fingerprint(wallet.publicKey)}
            </div>
          </div>

          <details className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <summary className="cursor-pointer text-sm font-medium text-white/70">
              Show public key
            </summary>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-white/40">
              {wallet.publicKey}
            </pre>
          </details>
        </div>
      </Card>

      <Card>
        <SectionTitle eyebrow="Backup" title="Protect your coins" />
        <div className="flex items-start gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-5">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-sm leading-relaxed text-white/60">
            This wallet is stored in this browser only. Clearing site data or switching
            devices means losing access unless you download a backup now.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={handleBackup} className="btn-primary">
            <Download size={16} /> Download backup
          </button>
          <Link to="/identity" className="btn-secondary">
            {wallet.alias ? 'Manage alias' : 'Claim an alias'}
          </Link>
          <button onClick={disconnect} className="btn-ghost">
            <LogOut size={16} /> Forget wallet
          </button>
        </div>
      </Card>

      {/* UTXO list */}
      <Card>
        <SectionTitle eyebrow="On chain" title="Your unspent outputs" />
        {utxos.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/40">
            Nothing spendable yet. Mine a block to earn the first reward.
          </p>
        ) : (
          <div className="space-y-2">
            {utxos.map((u) => (
              <div
                key={`${u.transactionId}:${u.index}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-white/60">
                    {u.transactionId.slice(0, 20)}…
                  </div>
                  <div className="text-[11px] text-white/35">output #{u.index}</div>
                </div>
                <div className="nums shrink-0 font-display text-sm font-semibold text-mint-300">
                  {formatCoins(u.amount)} KBX
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
