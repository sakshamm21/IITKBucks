import { useState } from 'react';
import { generateKeyPair, downloadFile, readFileAsText } from '../lib/crypto';
import { getUnusedOutputsByAlias, getUnusedOutputsByPublicKey, UnusedOutput } from '../lib/api';

type Tab = 'generate' | 'balance';

export default function Wallet() {
  const [tab, setTab] = useState<Tab>('generate');
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  // Balance check
  const [balanceMethod, setBalanceMethod] = useState<'alias' | 'pubkey'>('alias');
  const [aliasInput, setAliasInput] = useState('');
  const [pubKeyText, setPubKeyText] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceResult, setBalanceResult] = useState<{ outputs: UnusedOutput[]; total: bigint } | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const kp = await generateKeyPair();
      setKeys(kp);
    } catch (e: any) {
      alert('Key generation failed: ' + e.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleCheckBalance = async () => {
    setBalanceLoading(true);
    setBalanceError(null);
    setBalanceResult(null);
    try {
      let outputs: UnusedOutput[];
      if (balanceMethod === 'alias') {
        if (!aliasInput.trim()) throw new Error('Please enter an alias');
        const res = await getUnusedOutputsByAlias(aliasInput.trim());
        outputs = res.unusedOutputs;
      } else {
        const key = pubKeyText.trim();
        if (!key) throw new Error('Please paste a public key');
        const res = await getUnusedOutputsByPublicKey(key);
        outputs = res.unusedOutputs;
      }

      let total = BigInt(0);
      for (const o of outputs) {
        total += BigInt(o.amount);
      }
      setBalanceResult({ outputs, total });
    } catch (e: any) {
      setBalanceError(e.message || 'Failed to fetch balance');
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleUploadKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      setPubKeyText(text);
    } catch {
      alert('Failed to read file');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Wallet</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('generate')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'generate' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Generate Keys
        </button>
        <button
          onClick={() => setTab('balance')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'balance' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Check Balance
        </button>
      </div>

      {/* Generate Keys */}
      {tab === 'generate' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Generate RSA Key Pair</h3>
          <p className="text-sm text-gray-500 mb-6">
            Generate a new public/private key pair. Download both files and keep your private key safe!
          </p>

          {!keys ? (
            <button onClick={handleGenerate} disabled={genLoading} className="btn-primary">
              {genLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Generating...
                </span>
              ) : (
                '⚡ Generate Key Pair'
              )}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                ✅ Keys generated successfully! Download both files below.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label">Public Key</label>
                  <textarea
                    readOnly
                    value={keys.publicKey}
                    rows={6}
                    className="input-field font-mono text-xs bg-gray-50 resize-none"
                  />
                  <button
                    onClick={() => downloadFile('publicKey.pem', keys.publicKey)}
                    className="mt-2 btn-secondary text-sm py-1.5 px-3"
                  >
                    📥 Download Public Key
                  </button>
                </div>

                <div>
                  <label className="label">Private Key</label>
                  <textarea
                    readOnly
                    value={keys.privateKey}
                    rows={8}
                    className="input-field font-mono text-xs bg-red-50 resize-none"
                  />
                  <button
                    onClick={() => downloadFile('privateKey.pem', keys.privateKey)}
                    className="mt-2 btn-danger text-sm py-1.5 px-3"
                  >
                    📥 Download Private Key (Keep Secret!)
                  </button>
                </div>
              </div>

              <button onClick={() => setKeys(null)} className="btn-secondary text-sm">
                Generate New Keys
              </button>
            </div>
          )}
        </div>
      )}

      {/* Check Balance */}
      {tab === 'balance' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Check Balance</h3>

          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="balanceMethod"
                  checked={balanceMethod === 'alias'}
                  onChange={() => setBalanceMethod('alias')}
                  className="text-primary-600"
                />
                <span className="text-sm text-gray-700">By Alias</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="balanceMethod"
                  checked={balanceMethod === 'pubkey'}
                  onChange={() => setBalanceMethod('pubkey')}
                  className="text-primary-600"
                />
                <span className="text-sm text-gray-700">By Public Key</span>
              </label>
            </div>

            {balanceMethod === 'alias' ? (
              <div>
                <label className="label">Alias</label>
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="Enter alias..."
                  className="input-field"
                />
              </div>
            ) : (
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
            )}

            <button onClick={handleCheckBalance} disabled={balanceLoading} className="btn-primary">
              {balanceLoading ? 'Checking...' : '💰 Check Balance'}
            </button>

            {balanceError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {balanceError}
              </div>
            )}

            {balanceResult && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Balance</p>
                  <p className="text-3xl font-bold text-primary-600">{balanceResult.total.toString()} IITKB</p>
                </div>
                {balanceResult.outputs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Unspent Outputs ({balanceResult.outputs.length}):</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {balanceResult.outputs.map((o, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-white rounded border text-xs font-mono">
                          <span className="text-gray-500 truncate max-w-[200px]">{o.transactionId.slice(0, 16)}...:{o.index}</span>
                          <span className="font-semibold text-gray-800">{o.amount} IITKB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
