import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { Card, SectionTitle, ErrorState } from '../components/ui';
import { KeyRound, ShieldCheck, ArrowRight } from 'lucide-react';

/**
 * Shown before an API key exists. Mining, the faucet and peer management require one;
 * reading the chain and building a wallet do not.
 */
export default function Onboarding() {
  const { createKey } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await createKey();
      navigate('/');
    } catch {
      setError('Could not reach the node to create an API key. Is it running?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
      <Card>
        <SectionTitle eyebrow="Getting started" title="Create your API key" />

        <div className="space-y-5">
          <div className="flex items-start gap-4 rounded-2xl border border-iris-500/20 bg-iris-500/[0.07] p-5">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-iris-300" />
            <div>
              <p className="text-sm font-medium text-white/80">This is not a user account</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                There is no password. The key is a random token that lets this browser ask
                the node to mine, draw from the faucet and add peers. The node stores only
                its hash, and it has no access to your wallet keys.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="mb-3 text-sm font-medium text-white/80">What needs a key</p>
            <ul className="space-y-2 text-sm text-white/50">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mint-400" />
                Mining a block
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mint-400" />
                Drawing demo funds from the faucet
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mint-400" />
                Connecting to peers
              </li>
            </ul>
            <p className="mt-3 text-sm text-white/40">
              Reading the chain and creating a wallet do not.
            </p>
          </div>

          {error && <ErrorState message={error} />}

          <button onClick={handleCreate} disabled={busy} className="btn-primary w-full">
            <KeyRound size={16} />
            {busy ? 'Creating…' : 'Create API key'}
            {!busy && <ArrowRight size={16} />}
          </button>

          <button onClick={() => navigate('/')} className="btn-ghost w-full">
            Skip for now
          </button>
        </div>
      </Card>
    </div>
  );
}