import { useState, useEffect } from 'react';
import { getNodeInfo, NodeInfo, triggerMine } from '../lib/api';

export default function Dashboard() {
  const [info, setInfo] = useState<NodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getNodeInfo();
      setInfo(data);
    } catch (e: any) {
      setError(e.message || 'Failed to connect to node');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMine = async () => {
    try {
      await triggerMine();
      setTimeout(fetchInfo, 2000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading && !info) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="card text-center py-12">
        <div className="text-red-500 text-4xl mb-4">⚠</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Node Unreachable</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <button onClick={fetchInfo} className="btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${info ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <span className={`w-2 h-2 rounded-full ${info ? 'bg-green-500' : 'bg-red-500'}`} />
            {info ? 'Connected' : 'Disconnected'}
          </span>
          <button onClick={fetchInfo} className="btn-secondary text-sm py-1.5 px-3">Refresh</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Block Height" value={info?.blockIndex?.toString() ?? '—'} icon="⊞" color="blue" />
        <StatCard label="Pending Txns" value={info?.pendingTransactions?.toString() ?? '—'} icon="↗" color="amber" />
        <StatCard label="Peers" value={info?.peers?.length?.toString() ?? '—'} icon="◈" color="green" />
        <StatCard label="Aliases" value={info?.aliases?.length?.toString() ?? '—'} icon="◎" color="purple" />
      </div>

      {/* Node Info */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Node Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Node URL:</span>
            <span className="ml-2 font-mono text-gray-700">{info?.myurl || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Block Height:</span>
            <span className="ml-2 font-mono text-gray-700">{info?.blockIndex ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Peers */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Peers ({info?.peers?.length ?? 0})</h3>
        {info?.peers && info.peers.length > 0 ? (
          <div className="space-y-2">
            {info.peers.map((peer, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="font-mono text-sm text-gray-700">{peer}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No peers connected. Add peers in config.json.</p>
        )}
      </div>

      {/* Mine Button */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Mining</h3>
        <p className="text-sm text-gray-500 mb-4">
          Trigger mining to process {info?.pendingTransactions ?? 0} pending transactions into a new block.
        </p>
        <button onClick={handleMine} className="btn-primary" disabled={!info || info.pendingTransactions === 0}>
          ⛏ Mine Block
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: 'blue' | 'amber' | 'green' | 'purple' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
