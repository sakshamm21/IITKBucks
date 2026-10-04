import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../lib/useWallet';
import { useNodeStatus } from '../lib/useNodeStatus';
import { Card, SectionTitle, ErrorState, Badge } from '../components/ui';
import { triggerMine, ApiError } from '../lib/api';
import { Pickaxe, Cpu, Clock, Info, KeyRound } from 'lucide-react';

const BLOCK_REWARD = 100000n;

export default function Mine() {
  const { info, error: nodeError, refresh } = useNodeStatus();
  const { balance, refreshBalance } = useWallet();
  const [mining, setMining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMine() {
    setMining(true);
    setError(null);
    try {
      await triggerMine();
      // Proof-of-work takes real CPU time, so poll until the height moves.
      const before = info?.blockIndex ?? 0;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        await refresh();
        if ((info?.blockIndex ?? 0) > before || i === 39) break;
      }
      await refreshBalance();
    } catch (e) {
          if (e instanceof ApiError && e.needsAuth) {
            setError('Mining needs an API key. Create one to start mining blocks.');
          } else {
            setError('Could not start mining on this node.');
          }
        } finally {
          setMining(false);
        }
      }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
      <Card>
        <SectionTitle
          eyebrow="Proof of work"
          title="Mine a block"
          action={<Badge tone="iris">reward {BLOCK_REWARD.toLocaleString()} KBX</Badge>}
        />

        {nodeError && <div className="mb-5"><ErrorState message={nodeError} onRetry={refresh} /></div>}
        {error && <div className="mb-5"><ErrorState message={error} /></div>}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <Clock size={15} className="mb-2 text-white/35" />
            <div className="eyebrow mb-1">Chain height</div>
            <div className="nums font-display text-xl font-semibold text-white">
              {info?.blockIndex ?? '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <Cpu size={15} className="mb-2 text-white/35" />
            <div className="eyebrow mb-1">Mempool</div>
            <div className="nums font-display text-xl font-semibold text-white">
              {info?.pendingTransactions ?? '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <Pickaxe size={15} className="mb-2 text-white/35" />
            <div className="eyebrow mb-1">Your balance</div>
            <div className="nums font-display text-xl font-semibold text-mint-300">
              {balance.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-2xl border border-iris-500/20 bg-iris-500/[0.07] p-5">
          <Info size={18} className="mt-0.5 shrink-0 text-iris-300" />
          <p className="text-sm leading-relaxed text-white/55">
            Mining searches for a hash below the network target — roughly 67 million
            SHA-256 attempts, so a block takes about a minute of CPU on the node. The
                        reward is paid to the node&rsquo;s mining key rather than your browser
                        wallet, so use the faucet on the API key page to get coins you can spend.
          </p>
        </div>

        <button onClick={handleMine} disabled={mining} className="btn-primary mt-6 w-full">
          <Pickaxe size={16} />
          {mining ? 'Mining in progress…' : 'Mine a block'}
        </button>

                {error?.includes('API key') && (
                  <Link to="/account" className="btn-secondary mt-3 w-full">
                    <KeyRound size={16} /> Create an API key
                  </Link>
                )}
              </Card>
    </div>
  );
}
