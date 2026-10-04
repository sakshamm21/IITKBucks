import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../lib/useWallet';
import { Card, SectionTitle, ErrorState, Badge, EmptyState } from '../components/ui';
import { isValidAlias } from '../lib/format';
import { AtSign, ShieldCheck, Users, KeyRound, Search } from 'lucide-react';

export default function Identity() {
  const { wallet, claimAlias, resolveAlias } = useWallet();
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState('');
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  if (!wallet) {
    return (
      <div className="mx-auto max-w-lg animate-fade-up">
        <Card>
          <SectionTitle eyebrow="Identity" title="Create a wallet first" />
          <p className="mb-5 text-sm text-white/50">
            An alias is bound to a key pair, so you need a wallet before claiming a name.
          </p>
          <Link to="/wallet" className="btn-primary">
            <KeyRound size={16} /> Go to wallet
          </Link>
        </Card>
      </div>
    );
  }

  const valid = isValidAlias(alias.trim());

  async function handleClaim() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await claimAlias(alias.trim().toLowerCase());
      setAlias('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim that alias.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLookup() {
    if (!lookup.trim()) return;
    setLookupError(null);
    setLookupResult(null);
    try {
      const key = await resolveAlias(lookup.trim().toLowerCase());
      setLookupResult(key);
    } catch {
      setLookupError('No wallet is registered under that alias.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
      <Card>
        <SectionTitle
          eyebrow="Identity"
          title="Claim your name"
          action={wallet.alias ? <Badge tone="positive">@{wallet.alias}</Badge> : undefined}
        />

        {wallet.alias ? (
          <EmptyState
            icon={<AtSign size={40} />}
            title={`You are @${wallet.alias}`}
            description="This name is bound to your key. People can send KBX to it, and the node verifies the binding with your signature."
          />
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-4 rounded-2xl border border-iris-500/20 bg-iris-500/[0.07] p-5">
              <ShieldCheck size={19} className="mt-0.5 shrink-0 text-iris-300" />
              <p className="text-sm leading-relaxed text-white/60">
                Claiming requires signing a challenge with your private key. That proof is
                what stops anyone from reserving your name first and quietly receiving
                funds sent to it.
              </p>
            </div>

            {error && <ErrorState message={error} />}

            <div>
              <label htmlFor="alias" className="eyebrow mb-2 block">
                Choose an alias
              </label>
              <div className="relative">
                <AtSign size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="alias"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="satoshi"
                  className="input pl-10"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={32}
                />
              </div>
              <p className="mt-2 text-xs text-white/35">
                3–32 characters: lowercase letters, numbers, dots, dashes or underscores.
              </p>
            </div>

            <button
              onClick={handleClaim}
              disabled={!valid || busy}
              className="btn-primary w-full"
            >
              {busy ? 'Signing proof…' : 'Sign and claim'}
            </button>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle eyebrow="Directory" title="Look up an alias" />
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={lookup}
                onChange={(e) => setLookup(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="satoshi"
                className="input pl-10"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button onClick={handleLookup} disabled={!lookup.trim()} className="btn-secondary">
              Search
            </button>
          </div>

          {lookupError && <ErrorState message={lookupError} />}
          {lookupResult && (
            <div className="rounded-2xl border border-mint-500/20 bg-mint-500/[0.07] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-mint-300">
                <Users size={15} /> @{lookup.trim().toLowerCase()} is registered
              </div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-white/40">
                {lookupResult}
              </pre>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
