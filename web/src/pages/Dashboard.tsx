import { Link } from 'react-router-dom';
import { useWallet } from '../lib/useWallet';
import { useNodeStatus } from '../lib/useNodeStatus';
import { Card, SectionTitle, Stat, Badge, Skeleton, EmptyState, StatusDot, ErrorState } from '../components/ui';
import { formatCoins, formatCompact } from '../lib/format';
import { ArrowUpRight, Wallet as WalletIcon, Send, Pickaxe, Users } from 'lucide-react';

export default function Dashboard() {
  const { wallet, balance, utxos, loadingBalance, refreshBalance } = useWallet();
  const { info, live, error, refresh } = useNodeStatus();

  const quickActions = [
    { to: '/transfer', label: 'Send', icon: Send, hint: 'Spend to another alias' },
    { to: '/mine', label: 'Mine', icon: Pickaxe, hint: 'Earn a block reward' },
    { to: '/identity', label: 'Claim a name', icon: Users, hint: 'Register your alias' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Hero balance card */}
      <section className="relative overflow-hidden rounded-card border border-white/[0.07] bg-gradient-to-br from-iris-600/25 via-void-100/70 to-void-100/70 p-7 shadow-lift backdrop-blur-xl sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-iris-500/25 blur-3xl"
        />
        <div className="relative">
          <div className="mb-1 flex items-center gap-2">
            <span className="eyebrow">Total balance</span>
            <span className="chip !py-0.5">
              <StatusDot live={live} />
              {live ? 'node online' : 'node offline'}
            </span>
          </div>

          {loadingBalance ? (
            <Skeleton className="mt-3 h-14 w-64" />
          ) : (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="nums font-display text-display-lg text-gradient-iris">
                {wallet ? formatCompact(balance) : '0'}
              </span>
              <span className="font-display text-sm font-medium tracking-widest text-white/40">
                KBX
              </span>
            </div>
          )}

          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/45">
            {wallet
              ? 'Keys are generated and signed in this browser. Nothing you sign ever leaves your device.'
              : 'Create a wallet to start. Your key pair is generated locally — it is never sent to the node.'}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {wallet ? (
              <>
                <Link to="/transfer" className="btn-primary">
                  Send KBX <ArrowUpRight size={16} />
                </Link>
                <Link to="/wallet" className="btn-secondary">
                  <WalletIcon size={16} /> My wallet
                </Link>
              </>
            ) : (
              <Link to="/wallet" className="btn-primary">
                Create your wallet <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Node + wallet facts */}
      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="!p-5">
            <Stat
              label="Chain height"
              value={info ? info.blockIndex : '—'}
              hint={info ? `block #${info.blockIndex}` : 'waiting for node'}
              tone={info ? 'default' : 'warning'}
            />
          </Card>
          <Card className="!p-5">
            <Stat
              label="Your UTXOs"
              value={wallet ? utxos.length : 0}
              hint={wallet ? 'spendable outputs' : 'no wallet'}
            />
          </Card>
          <Card className="!p-5">
            <Stat
              label="Mempool"
              value={info ? info.pendingTransactions : '—'}
              hint="transactions waiting"
              tone={info && info.pendingTransactions > 0 ? 'warning' : 'default'}
            />
          </Card>
          <Card className="!p-5">
            <Stat
              label="Network"
              value={info ? info.peers.length : '—'}
              hint="connected peers"
              tone={info && info.peers.length === 0 ? 'warning' : 'positive'}
            />
          </Card>
        </div>
      )}

      {/* Quick actions */}
      <Card>
        <SectionTitle eyebrow="Actions" title="What do you want to do?" />
        <div className="grid gap-3 sm:grid-cols-3">
          {quickActions.map(({ to, label, icon: Icon, hint }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-all duration-300 hover:border-iris-400/40 hover:bg-iris-500/[0.07]"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-iris-500/15 text-iris-300 transition-colors group-hover:bg-iris-500/25">
                <Icon size={19} />
              </div>
              <div className="font-display text-base font-semibold text-white">{label}</div>
              <div className="mt-1 text-xs text-white/40">{hint}</div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Wallet state */}
      <Card>
        <SectionTitle
          eyebrow="Getting started"
          title="How IITkBucks works"
          action={wallet ? <Badge tone="positive">Wallet ready</Badge> : undefined}
        />
        {!wallet ? (
          <EmptyState
            icon={<WalletIcon size={40} />}
            title="No wallet yet"
            description="Create one and it stays in this browser. You can back it up as a PEM file at any time."
            action={
              <Link to="/wallet" className="btn-primary">
                Create wallet
              </Link>
            }
          />
        ) : (
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              {
                n: '01',
                t: 'Get KBX',
                d: 'Mine a block. The first transaction in each block pays a fixed reward to the miner.',
              },
              {
                n: '02',
                t: 'Claim a name',
                d: 'Register an alias by signing a proof of ownership, so nobody can take it first.',
              },
              {
                n: '03',
                t: 'Send KBX',
                d: 'Spend to any alias. Your key signs each input in the browser before it is broadcast.',
              },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="mb-2 font-mono text-xs text-iris-400/80">{s.n}</div>
                <div className="font-display text-base font-semibold text-white">{s.t}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-white/45">{s.d}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
