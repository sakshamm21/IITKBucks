import { NavLink, Outlet } from 'react-router-dom';
import { useWallet } from './lib/useWallet';
import { useNodeStatus } from './lib/useNodeStatus';
import { useAuth } from './lib/useAuth';
import { StatusDot } from './components/ui';
import { LayoutDashboard, Wallet, Send, Pickaxe, AtSign, Blocks, KeyRound } from 'lucide-react';
import { formatCompact } from './lib/format';

const NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
  { to: '/transfer', label: 'Send', icon: Send },
  { to: '/mine', label: 'Mine', icon: Pickaxe },
  { to: '/identity', label: 'Identity', icon: AtSign },
  { to: '/explorer', label: 'Explorer', icon: Blocks },
    { to: '/account', label: 'API key', icon: KeyRound },
  ];

export default function App() {
  const { wallet, balance } = useWallet();
  const { live, info } = useNodeStatus();
  const { apiKey, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-void/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-iris-500 to-iris-700 text-sm font-bold text-white shadow-glow">
              ₿
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              IITkBucks
            </span>
          </NavLink>

          <div className="flex items-center gap-3">
            <span className="chip hidden sm:inline-flex">
              <StatusDot live={live} />
              {live ? `height ${info?.blockIndex ?? 0}` : 'offline'}
            </span>
            {wallet && (
              <span className="chip !border-mint-500/25 !bg-mint-500/10 !text-mint-300">
                {formatCompact(balance)} KBX
              </span>
            )}
                        <NavLink
                          to="/account"
                          className="chip transition-colors hover:border-iris-400/40 hover:text-white"
                          title={apiKey ? 'API key active' : 'Create an API key'}
                        >
                          <KeyRound size={12} />
                          <span className="hidden sm:inline">
                            {apiKey ? 'Key active' : 'No key'}
                          </span>
                        </NavLink>
          </div>
        </div>

        {/* Horizontal nav — works well on mobile without a hamburger. */}
        <nav className="mx-auto max-w-6xl px-3 pb-2">
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-iris-500/15 text-iris-200'
                      : 'text-white/45 hover:bg-white/[0.05] hover:text-white/80'
                  }`
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-7">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-8">
        <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-5 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Educational proof-of-work blockchain. Not security-audited — do not use real value.
          </p>
          <p className="font-mono">RSA-PSS · SHA-256 · UTXO</p>
        </div>
      </footer>
    </div>
  );
}
