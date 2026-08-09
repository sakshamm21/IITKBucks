import { useState } from 'react';
import { getBlock, getPendingTransactions, getNodeInfo, NodeInfo } from '../lib/api';
import { decodeBlock, decodePendingTransaction, DecodedBlock } from '../lib/blockchain';

export default function Explorer() {
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [blockIndex, setBlockIndex] = useState('');
  const [block, setBlock] = useState<DecodedBlock | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const [pendingTxns, setPendingTxns] = useState<any[] | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'blocks' | 'pending'>('blocks');

  const loadNodeInfo = async () => {
    try {
      const info = await getNodeInfo();
      setNodeInfo(info);
    } catch {}
  };

  const handleFetchBlock = async () => {
    const idx = parseInt(blockIndex);
    if (isNaN(idx) || idx < 0) {
      setBlockError('Please enter a valid block index');
      return;
    }
    setBlockLoading(true);
    setBlockError(null);
    setBlock(null);
    try {
      const raw = await getBlock(idx);
      const decoded = await decodeBlock(raw);
      setBlock(decoded);
    } catch (e: any) {
      setBlockError(e.message || 'Block not found');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleLoadPending = async () => {
    setPendingLoading(true);
    try {
      const txns = await getPendingTransactions();
      setPendingTxns(txns.map(decodePendingTransaction));
    } catch (e: any) {
      setBlockError(e.message);
    } finally {
      setPendingLoading(false);
    }
  };

  const formatTimestamp = (ts: bigint): string => {
    // Timestamp is in nanoseconds from nano-time
    const ms = Number(ts / BigInt(1000000));
    return new Date(ms).toLocaleString();
  };

  const shortenHex = (hex: string, len = 16): string => {
    if (hex.length <= len * 2) return hex;
    return hex.slice(0, len) + '...' + hex.slice(-len);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Block Explorer</h2>
        <button onClick={loadNodeInfo} className="btn-secondary text-sm py-1.5 px-3">
          Load Node Info
        </button>
      </div>

      {nodeInfo && (
        <div className="card flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Current Height:</span>
            <span className="ml-2 font-bold text-gray-800">{nodeInfo.blockIndex}</span>
          </div>
          <div>
            <span className="text-gray-500">Pending Txns:</span>
            <span className="ml-2 font-bold text-gray-800">{nodeInfo.pendingTransactions}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('blocks')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'blocks' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Browse Blocks
        </button>
        <button
          onClick={() => { setActiveTab('pending'); handleLoadPending(); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Pending Transactions
        </button>
      </div>

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Fetch Block</h3>
          <div className="flex gap-3">
            <input
              type="number"
              value={blockIndex}
              onChange={(e) => setBlockIndex(e.target.value)}
              placeholder="Block index..."
              className="input-field w-48"
              min="0"
              onKeyDown={(e) => e.key === 'Enter' && handleFetchBlock()}
            />
            <button onClick={handleFetchBlock} disabled={blockLoading} className="btn-primary">
              {blockLoading ? 'Loading...' : '⊞ Fetch Block'}
            </button>
          </div>

          {blockError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{blockError}</div>
          )}

          {block && (
            <div className="mt-6 space-y-4">
              {/* Block Header */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">Block #{block.header.index}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Parent Hash:</span>
                    <p className="font-mono text-xs text-gray-700 mt-0.5 break-all">{block.header.parentHash}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Body Hash:</span>
                    <p className="font-mono text-xs text-gray-700 mt-0.5 break-all">{block.header.bodyHash}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Target:</span>
                    <p className="font-mono text-xs text-gray-700 mt-0.5 break-all">{block.header.target}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nonce:</span>
                    <p className="font-mono text-sm text-gray-700 mt-0.5">{block.header.nonce.toString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Timestamp:</span>
                    <p className="text-sm text-gray-700 mt-0.5">{formatTimestamp(block.header.timestamp)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <p className="text-sm text-gray-700 mt-0.5">{block.rawSize.toLocaleString()} bytes</p>
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">
                  Transactions ({block.transactions.length})
                </h4>
                <div className="space-y-3">
                  {block.transactions.map((tx, ti) => (
                    <div key={ti} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500">
                          {ti === 0 ? '💰 Coinbase' : `Tx #${ti}`}
                        </span>
                        <span className="font-mono text-xs text-gray-400">{shortenHex(tx.txId)}</span>
                      </div>

                      {/* Inputs */}
                      {tx.numInputs > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-500">Inputs ({tx.numInputs}):</span>
                          <div className="space-y-1 mt-1">
                            {tx.inputs.map((inp, ii) => (
                              <div key={ii} className="bg-gray-50 rounded px-2 py-1 text-xs font-mono">
                                <span className="text-gray-400">{shortenHex(inp.transactionId, 10)}:{inp.index}</span>
                                <span className="ml-2 text-gray-500">sig: {shortenHex(inp.signature, 8)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Outputs */}
                      <div>
                        <span className="text-xs text-gray-500">Outputs ({tx.numOutputs}):</span>
                        <div className="space-y-1 mt-1">
                          {tx.outputs.map((out, oi) => (
                            <div key={oi} className="bg-green-50 rounded px-2 py-1 text-xs flex justify-between">
                              <span className="font-mono text-green-700 truncate max-w-[300px]">
                                {out.pubKey.slice(0, 40)}...
                              </span>
                              <span className="font-semibold text-green-800 ml-2 whitespace-nowrap">
                                {out.coins.toString()} IITKB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Pending Transactions</h3>
            <button onClick={handleLoadPending} disabled={pendingLoading} className="btn-secondary text-sm py-1.5 px-3">
              {pendingLoading ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {pendingTxns === null && !pendingLoading && (
            <p className="text-sm text-gray-400">Click refresh to load pending transactions.</p>
          )}

          {pendingLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          )}

          {pendingTxns && pendingTxns.length === 0 && (
            <p className="text-sm text-gray-400">No pending transactions.</p>
          )}

          {pendingTxns && pendingTxns.length > 0 && (
            <div className="space-y-3">
              {pendingTxns.map((tx, ti) => (
                <div key={ti} className="border border-gray-200 rounded-lg p-4">
                  <span className="text-xs font-medium text-gray-500">Pending Tx #{ti + 1}</span>

                  <div className="mt-2 space-y-1">
                    <span className="text-xs text-gray-500">Inputs ({tx.inputs.length}):</span>
                    {tx.inputs.map((inp: any, ii: number) => (
                      <div key={ii} className="bg-gray-50 rounded px-2 py-1 text-xs font-mono">
                        <span className="text-gray-400">{shortenHex(inp.transactionId, 10)}:{inp.index}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 space-y-1">
                    <span className="text-xs text-gray-500">Outputs ({tx.outputs.length}):</span>
                    {tx.outputs.map((out: any, oi: number) => (
                      <div key={oi} className="bg-green-50 rounded px-2 py-1 text-xs flex justify-between">
                        <span className="font-mono text-green-700 truncate max-w-[300px]">
                          {out.recipient.slice(0, 40)}...
                        </span>
                        <span className="font-semibold text-green-800 ml-2 whitespace-nowrap">
                          {out.amount} IITKB
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Total out: <span className="font-semibold">{tx.totalOut.toString()} IITKB</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
