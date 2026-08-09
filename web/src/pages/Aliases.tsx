import { useState } from 'react';
import { addAlias, getPublicKey, getNodeInfo, NodeInfo } from '../lib/api';
import { readFileAsText } from '../lib/crypto';

export default function Aliases() {
  const [alias, setAlias] = useState('');
  const [pubKeyText, setPubKeyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Lookup
  const [lookupAlias, setLookupAlias] = useState('');
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Node aliases list
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [showNodeInfo, setShowNodeInfo] = useState(false);

  const handleAddAlias = async () => {
    if (!alias.trim()) {
      setMessage({ type: 'error', text: 'Please enter an alias' });
      return;
    }
    if (!pubKeyText.trim()) {
      setMessage({ type: 'error', text: 'Please provide a public key' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await addAlias(alias.trim(), pubKeyText.trim());
      setMessage({ type: 'success', text: `Alias "${alias.trim()}" added successfully!` });
      setAlias('');
      setPubKeyText('');
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to add alias (may already exist)' });
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async () => {
    if (!lookupAlias.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await getPublicKey(lookupAlias.trim());
      setLookupResult(res.publicKey);
    } catch (e: any) {
      setLookupResult('__error__');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleUploadKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      setPubKeyText(text);
    } catch {
      setMessage({ type: 'error', text: 'Failed to read file' });
    }
  };

  const loadNodeAliases = async () => {
    try {
      const info = await getNodeInfo();
      setNodeInfo(info);
      setShowNodeInfo(true);
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Failed to load node info' });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Aliases</h2>

      {/* Add Alias */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Register Alias</h3>
        <p className="text-sm text-gray-500 mb-4">
          Link a human-readable alias to your public key so others can send you coins easily.
        </p>

        <div className="space-y-4">
          <div>
            <label className="label">Alias Name</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. saksham, alice, bob"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Public Key</label>
            <textarea
              value={pubKeyText}
              onChange={(e) => setPubKeyText(e.target.value)}
              placeholder="Paste public key PEM or upload file..."
              rows={4}
              className="input-field font-mono text-xs resize-none"
            />
            <input
              type="file"
              accept=".pem"
              onChange={handleUploadKey}
              className="mt-2 text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          <button onClick={handleAddAlias} disabled={loading} className="btn-primary">
            {loading ? 'Registering...' : '◎ Register Alias'}
          </button>

          {message && (
            <div className={`rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>

      {/* Lookup Alias */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Lookup Alias</h3>
        <p className="text-sm text-gray-500 mb-4">
          Resolve an alias to its public key (useful when sending coins).
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={lookupAlias}
            onChange={(e) => setLookupAlias(e.target.value)}
            placeholder="Enter alias..."
            className="input-field flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
          <button onClick={handleLookup} disabled={lookupLoading} className="btn-primary">
            {lookupLoading ? '...' : '🔍 Lookup'}
          </button>
        </div>

        {lookupResult === '__error__' && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            Alias not found.
          </div>
        )}
        {lookupResult && lookupResult !== '__error__' && (
          <div className="mt-3 bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Public Key:</p>
            <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{lookupResult}</pre>
          </div>
        )}
      </div>

      {/* Registered Aliases */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Registered Aliases</h3>
          <button onClick={loadNodeAliases} className="btn-secondary text-sm py-1.5 px-3">
            Load from Node
          </button>
        </div>

        {showNodeInfo && nodeInfo ? (
          nodeInfo.aliases.length > 0 ? (
            <div className="space-y-2">
              {nodeInfo.aliases.map((a, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="font-medium text-gray-700">{a}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No aliases registered yet.</p>
          )
        ) : (
          <p className="text-sm text-gray-400">Click "Load from Node" to see registered aliases.</p>
        )}
      </div>
    </div>
  );
}
