import { useCallback, useEffect, useState } from 'react';
import { Card, SectionTitle, Badge, Skeleton, EmptyState, CopyButton } from '../components/ui';
import { useNodeStatus } from '../lib/useNodeStatus';
import { getPendingTransactions, tryGetBlock, type PendingTransaction } from '../lib/api';
import { decodeBlock, type DecodedBlock } from '../lib/blockchain';
import { formatCoins, shortHash, timeAgo } from '../lib/format';
import { Blocks, Layers, ArrowUpRight, Clock } from 'lucide-react';

export default function Explorer() {
  const { info, live } = useNodeStatus();
  const [pending, setPending] = useState<PendingTransaction[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [block, setBlock] = useState<DecodedBlock | null>(null);
  const [loadingBlock, setLoadingBlock] = useState(false);

  const height = info?.blockIndex ?? 0;
    // Highest block known to exist on disk. The node reports the index the NEXT block
    // will use, so the last stored block is height - 1.
    const tip = Math.max(0, height - 1);

    useEffect(() => {
      let cancelled = false;
      async function load() {
        try {
          const p = await getPendingTransactions();
          if (!cancelled) setPending(p);
        } catch {
          if (!cancelled) setPending([]);
        }
      }
      void load();
      const t = window.setInterval(load, 5000);
      return () => {
        cancelled = true;
        window.clearInterval(t);
      };
    }, []);

    // Default to the tip once we know the height.
    useEffect(() => {
      if (selected === null && tip > 0) setSelected(tip);
    }, [tip, selected]);

  const loadBlock = useCallback(async (index: number) => {
    setLoadingBlock(true);
    try {
      const raw = await tryGetBlock(index);
      if (!raw) {
        setBlock(null);
        return;
      }
      setBlock(await decodeBlock(raw));
    } catch {
      setBlock(null);
    } finally {
      setLoadingBlock(false);
    }
  }, []);

  useEffect(() => {
    if (selected !== null) void loadBlock(selected);
  }, [selected, loadBlock]);

  return (
    <div className="space-y-5 animate-fade-up">
      <Card>
        <SectionTitle
          eyebrow="Ledger"
          title="Block explorer"
          action={<Badge tone={live ? 'positive' : 'negative'}>{live ? 'live' : 'offline'}</Badge>}
        />

        <div className="mb-6 flex items-center gap-3">
          <span className="eyebrow whitespace-nowrap">Height</span>
          <input
            type="number"
            min={0}
                      max={tip}
            value={selected ?? 0}
                      onChange={(e) => setSelected(Math.max(0, Math.min(tip, Number(e.target.value) || 0)))}
            className="input !w-32 !py-2 text-center"
            aria-label="Block height"
          />
          <button
                      onClick={() => setSelected(tip)}
            className="btn-ghost !px-3 !py-2 !text-xs"
          >
            Latest
          </button>
        </div>

        {loadingBlock ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !block ? (
          <EmptyState
            icon={<Blocks size={40} />}
            title="No block at this height"
            description="Try a lower height, or mine a new block."
          />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="eyebrow mb-1">Index</div>
                <div className="nums font-display text-lg font-semibold text-white">
                  {block.header.index}
                </div>
              </div>
              <div>
                <div className="eyebrow mb-1">Transactions</div>
                <div className="nums font-display text-lg font-semibold text-white">
                  {block.transactions.length}
                </div>
              </div>
              <div>
                <div className="eyebrow mb-1">Size</div>
                <div className="nums font-display text-lg font-semibold text-white">
                  {block.rawSize.toLocaleString()} B
                </div>
              </div>
              <div>
                <div className="eyebrow mb-1">Mined</div>
                <div className="font-display text-lg font-semibold text-white">
                  {timeAgo(block.header.timestamp)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Row label="Parent hash" value={block.header.parentHash} />
              <Row label="Body hash" value={block.header.bodyHash} />
              <Row label="Nonce" value={block.header.nonce.toString()} />
              <Row label="Target" value={block.header.target} />
            </div>

            <div>
              <div className="eyebrow mb-3">Transactions in this block</div>
              <div className="space-y-2">
                {block.transactions.map((tx, i) => {
                  const out = tx.outputs[0];
                  const value = out ? out.coins : 0n;
                  return (
                    <div
                      key={tx.txId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white/60">
                            {shortHash(tx.txId, 10, 6)}
                          </span>
                          {i === 0 && <Badge tone="iris">coinbase</Badge>}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/35">
                          {tx.numInputs} in · {tx.numOutputs} out
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="nums font-display text-sm font-semibold text-mint-300">
                          {formatCoins(value)} KBX
                        </span>
                        <CopyButton value={tx.txId} label="Copy hash" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          eyebrow="Waiting to be mined"
          title="Mempool"
          action={<Badge tone={pending?.length ? 'warning' : 'neutral'}>{pending?.length ?? 0} pending</Badge>}
        />

        {pending === null ? (
          <Skeleton className="h-16 w-full" />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={<Layers size={36} />}
            title="Mempool is empty"
            description="Transactions appear here until the next block includes them."
          />
        ) : (
          <div className="space-y-2">
            {pending.map((tx, i) => {
              const total = tx.outputs.reduce((s, o) => s + BigInt(o.amount), 0n);
              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-white/60">
                      {shortHash(tx.inputs[0]?.transactionId ?? 'coinbase', 10, 6)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/35">
                      {tx.inputs.length} in · {tx.outputs.length} out
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="chip">
                      <Clock size={11} /> pending
                    </span>
                    <span className="nums font-display text-sm font-semibold text-white">
                      {formatCoins(total)} KBX
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-center gap-2 text-xs text-white/25">
        <ArrowUpRight size={12} />
        Blocks are raw bytes from the node — hashes here are computed in your browser
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-2.5">
      <span className="eyebrow">{label}</span>
      <span className="flex items-center gap-2">
        <code className="break-all font-mono text-[11px] text-white/45">{value}</code>
        <CopyButton value={value} label="Copy" />
      </span>
    </div>
  );
}
