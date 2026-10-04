import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../lib/useWallet';
import { useNodeStatus } from '../lib/useNodeStatus';
import { Card, SectionTitle, ErrorState, Badge, CopyButton } from '../components/ui';
import { formatCoins } from '../lib/format';
import { Send, ArrowRight, Wallet as WalletIcon, CheckCircle2 } from 'lucide-react';

type Stage = 'idle' | 'signing' | 'submitting' | 'done';

export default function Transfer() {
  const { wallet, balance, send, loadingBalance } = useWallet();
  const { info } = useNodeStatus();

  const [toAlias, setToAlias] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<{ to: string; amount: string } | null>(null);

  if (!wallet) {
    return (
      <div className="mx-auto max-w-lg animate-fade-up">
        <Card>
          <SectionTitle eyebrow="Send" title="Connect a wallet first" />
          <p className="mb-5 text-sm text-white/50">
            You need a wallet before you can send KBX.
          </p>
          <Link to="/wallet" className="btn-primary">
            <WalletIcon size={16} /> Go to wallet
          </Link>
        </Card>
      </div>
    );
  }

  const parsed = BigInt(amount || '0');
  const validAmount = parsed > 0n && parsed <= balance;
  const canSend = toAlias.trim().length > 0 && validAmount && stage === 'idle';

  async function handleSend() {
    if (!canSend) return;
    setError(null);
    setStage('signing');
    try {
      // Signing happens locally in the browser; the node only receives the
      // signed transaction, never the private key.
      setStage('submitting');
      await send(toAlias.trim(), parsed);
      setLastTx({ to: toAlias.trim(), amount: parsed.toString() });
      setStage('done');
      setToAlias('');
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed.');
      setStage('idle');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
      <Card>
        <SectionTitle
          eyebrow="Transfer"
          title="Send KBX"
          action={<Badge tone="iris">balance {formatCoins(balance)}</Badge>}
        />

        {stage === 'done' && lastTx ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center rounded-2xl border border-mint-500/25 bg-mint-500/[0.07] px-6 py-8 text-center">
              <CheckCircle2 size={36} className="mb-3 text-mint-300" />
              <h3 className="font-display text-lg font-semibold text-white">Transaction broadcast</h3>
              <p className="mt-1.5 text-sm text-white/50">
                Sent {formatCoins(lastTx.amount)} KBX to @{lastTx.to}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setStage('idle')} className="btn-primary">
                Send another
              </button>
              <Link to="/explorer" className="btn-secondary">
                Watch the mempool <ArrowRight size={16} />
              </Link>
            </div>
            {info && info.pendingTransactions > 0 && (
              <p className="text-center text-xs text-white/35">
                Waiting to be included in a block — mining takes roughly a minute.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {error && <ErrorState message={error} />}

            <div>
              <label htmlFor="to" className="eyebrow mb-2 block">
                Recipient alias
              </label>
              <input
                id="to"
                value={toAlias}
                onChange={(e) => setToAlias(e.target.value)}
                placeholder="satoshi"
                className="input"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="amount" className="eyebrow">
                  Amount
                </label>
                <button
                  onClick={() => setAmount(balance.toString())}
                  className="text-xs font-medium text-iris-300 hover:text-iris-200"
                >
                  Use max
                </button>
              </div>
              <input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                inputMode="numeric"
                className="input"
              />
              {amount && !validAmount && (
                <p className="mt-2 text-xs text-coral-300">
                  {parsed > balance ? 'Amount exceeds your balance.' : 'Enter an amount above zero.'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-white/45">Signing in this browser</span>
                <CopyButton value="your private key never leaves this device" label="Why?" />
              </div>
              <p className="text-xs leading-relaxed text-white/35">
                Each input is signed with your key, then the signed transaction is sent to the
                node and placed in the mempool until the next block is mined.
              </p>
            </div>

            <button
              onClick={handleSend}
              disabled={!canSend || loadingBalance}
              className="btn-primary w-full"
            >
              <Send size={16} />
              {stage === 'signing'
                ? 'Signing…'
                : stage === 'submitting'
                  ? 'Broadcasting…'
                  : 'Sign and send'}
            </button>

            {balance === 0n && (
              <p className="text-center text-xs text-white/35">
                You have no KBX yet. <Link to="/mine" className="text-iris-300 underline">Mine a block</Link> to earn some.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
