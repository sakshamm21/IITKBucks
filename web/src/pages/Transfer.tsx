import { useState } from 'react';
import {
  getUnusedOutputsByPublicKey,
  getPublicKey,
  submitTransaction,
  UnusedOutput,
  TransactionOutput,
} from '../lib/api';
import {
  buildOutputBuffer,
  hashOutputBuffer,
  signInput,
  readFileAsText,
} from '../lib/crypto';

interface Recipient {
  id: number;
  method: 'alias' | 'pubkey';
  aliasOrKey: string;
  amount: string;
  resolvedKey: string | null;
}

export default function Transfer() {
  // Sender keys
  const [pubKey, setPubKey] = useState('');
  const [privKey, setPrivKey] = useState('');

  // Balance
  const [unusedOutputs, setUnusedOutputs] = useState<UnusedOutput[]>([]);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: 1, method: 'alias', aliasOrKey: '', amount: '', resolvedKey: null },
  ]);
  const [fee, setFee] = useState('0');

  // State
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleUploadPubKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    setPubKey(text);
  };

  const handleUploadPrivKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    setPrivKey(text);
  };

  const handleLoadBalance = async () => {
    if (!pubKey.trim()) {
      setError('Please provide your public key first');
      return;
    }
    setBalanceLoading(true);
    setError(null);
    try {
      const res = await getUnusedOutputsByPublicKey(pubKey.trim());
      setUnusedOutputs(res.unusedOutputs);
      let total = BigInt(0);
      for (const o of res.unusedOutputs) {
        total += BigInt(o.amount);
      }
      setBalance(total);
      setBalanceLoaded(true);
      if (res.unusedOutputs.length === 0) {
        setError('This key has no coins yet. Mine a block or ask a friend to send you IITKB!');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect to node');
      setBalanceLoaded(false);
    } finally {
      setBalanceLoading(false);
    }
  };

  const addRecipient = () => {
    const newId = Math.max(0, ...recipients.map((r) => r.id)) + 1;
    setRecipients([
      ...recipients,
      { id: newId, method: 'alias', aliasOrKey: '', amount: '', resolvedKey: null },
    ]);
  };

  const removeRecipient = (id: number) => {
    if (recipients.length <= 1) return;
    setRecipients(recipients.filter((r) => r.id !== id));
  };

  const updateRecipient = (id: number, field: keyof Recipient, value: string) => {
    setRecipients(
      recipients.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const resolveRecipient = async (id: number) => {
    const r = recipients.find((r) => r.id === id);
    if (!r || r.method !== 'alias' || !r.aliasOrKey.trim()) return;
    try {
      const res = await getPublicKey(r.aliasOrKey.trim());
      updateRecipient(id, 'resolvedKey', res.publicKey);
    } catch {
      setError(`Alias "${r.aliasOrKey}" not found`);
    }
  };

  const totalSpending = (): bigint => {
    let total = BigInt(0);
    for (const r of recipients) {
      if (r.amount) total += BigInt(r.amount);
    }
    return total + BigInt(fee || '0');
  };

  const handleSend = async () => {
    setError(null);
    setSuccess(null);

    if (!pubKey.trim() || !privKey.trim()) {
      setError('Please provide both public and private keys');
      return;
    }
    if (!balanceLoaded || unusedOutputs.length === 0) {
      setError('Please load your balance first');
      return;
    }

    // Validate recipients
    const outputs: TransactionOutput[] = [];
    for (const r of recipients) {
      const key = r.method === 'pubkey' ? r.aliasOrKey.trim() : r.resolvedKey;
      if (!key) {
        setError('Please resolve all alias recipients first');
        return;
      }
      if (!r.amount || BigInt(r.amount) <= 0) {
        setError('All recipients must have a positive amount');
        return;
      }
      outputs.push({ recipient: key, amount: r.amount });
    }

    const spending = totalSpending();
    if (spending > balance) {
      setError(`Insufficient balance! You have ${balance.toString()} but trying to spend ${spending.toString()}`);
      return;
    }

    // Add change output back to sender
    const remainder = balance - spending;
    if (remainder > BigInt(0)) {
      outputs.push({ recipient: pubKey.trim(), amount: remainder.toString() });
    }

    setSending(true);
    try {
      // Build output buffer and hash it
      const outputBuf = buildOutputBuffer(outputs);
      const hashedOutput = await hashOutputBuffer(outputBuf);

      // Sign each input
      const inputs = [];
      for (const uo of unusedOutputs) {
        const signature = await signInput(
          privKey.trim(),
          uo.transactionId,
          uo.index,
          hashedOutput
        );
        inputs.push({
          transactionId: uo.transactionId,
          index: uo.index,
          signature,
        });
      }

      // Submit
      await submitTransaction(inputs, outputs);
      setSuccess(
        `Transaction submitted! Spending ${spending.toString()} IITKB. The node will mine it into a block shortly.`
      );

      // Refresh balance after a delay
      setTimeout(() => handleLoadBalance(), 3000);
    } catch (e: any) {
      setError(e.message || 'Transaction failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Transfer Coins</h2>

      {/* Sender Keys */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Keys</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Public Key</label>
            <textarea
              value={pubKey}
              onChange={(e) => setPubKey(e.target.value)}
              placeholder="Paste your public key PEM..."
              rows={3}
              className="input-field font-mono text-xs resize-none"
            />
            <input
              type="file"
              accept=".pem"
              onChange={handleUploadPubKey}
              className="mt-2 text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700"
            />
          </div>
          <div>
            <label className="label">Private Key</label>
            <textarea
              value={privKey}
              onChange={(e) => setPrivKey(e.target.value)}
              placeholder="Paste your private key PEM..."
              rows={3}
              className="input-field font-mono text-xs resize-none bg-red-50"
            />
            <input
              type="file"
              accept=".pem"
              onChange={handleUploadPrivKey}
              className="mt-2 text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700"
            />
          </div>
        </div>

        <button onClick={handleLoadBalance} disabled={balanceLoading} className="btn-primary mt-4">
          {balanceLoading ? 'Loading...' : '💰 Load Balance'}
        </button>

        {balanceLoaded && (
          <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-4">
            <p className="text-sm text-primary-600">Available Balance</p>
            <p className="text-2xl font-bold text-primary-700">{balance.toString()} IITKB</p>
            <p className="text-xs text-primary-500 mt-1">{unusedOutputs.length} unspent outputs</p>
          </div>
        )}
      </div>

      {/* Recipients */}
      {balanceLoaded && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Recipients</h3>
            <button onClick={addRecipient} className="btn-secondary text-sm py-1.5 px-3">
              + Add Recipient
            </button>
          </div>

          <div className="space-y-4">
            {recipients.map((r) => (
              <div key={r.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Recipient #{r.id}</span>
                  {recipients.length > 1 && (
                    <button onClick={() => removeRecipient(r.id)} className="text-red-500 text-sm hover:text-red-700">
                      Remove
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <select
                    value={r.method}
                    onChange={(e) => updateRecipient(r.id, 'method', e.target.value)}
                    className="input-field w-32"
                  >
                    <option value="alias">By Alias</option>
                    <option value="pubkey">By Key</option>
                  </select>

                  {r.method === 'alias' ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={r.aliasOrKey}
                        onChange={(e) => updateRecipient(r.id, 'aliasOrKey', e.target.value)}
                        placeholder="Enter alias..."
                        className="input-field flex-1"
                      />
                      <button onClick={() => resolveRecipient(r.id)} className="btn-secondary text-sm py-1.5 px-3 whitespace-nowrap">
                        Resolve
                      </button>
                    </div>
                  ) : (
                    <textarea
                      value={r.aliasOrKey}
                      onChange={(e) => updateRecipient(r.id, 'aliasOrKey', e.target.value)}
                      placeholder="Paste recipient public key..."
                      rows={2}
                      className="input-field flex-1 font-mono text-xs resize-none"
                    />
                  )}
                </div>

                {r.resolvedKey && (
                  <div className="bg-green-50 border border-green-200 rounded p-2">
                    <p className="text-xs text-green-700 font-mono truncate">✓ Resolved: {r.resolvedKey.slice(0, 60)}...</p>
                  </div>
                )}

                <div>
                  <label className="label">Amount (IITKB)</label>
                  <input
                    type="text"
                    value={r.amount}
                    onChange={(e) => updateRecipient(r.id, 'amount', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="input-field w-48"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Fee */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="label">Transaction Fee (IITKB)</label>
            <input
              type="text"
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="input-field w-48"
            />
            <p className="text-xs text-gray-400 mt-1">Higher fees incentivize miners to include your transaction.</p>
          </div>

          {/* Summary */}
          <div className="mt-4 bg-gray-100 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Spending:</span>
              <span className="font-mono font-semibold">{totalSpending().toString()} IITKB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Balance:</span>
              <span className="font-mono">{balance.toString()} IITKB</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-1 mt-1">
              <span className="text-gray-600">Remaining:</span>
              <span className={`font-mono font-semibold ${totalSpending() > balance ? 'text-red-600' : 'text-green-600'}`}>
                {(balance - totalSpending()).toString()} IITKB
              </span>
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || totalSpending() > balance || totalSpending() <= BigInt(0)}
            className="btn-primary mt-4 w-full text-lg"
          >
            {sending ? '⏳ Signing & Sending...' : '↗ Send Transaction'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">{success}</div>
      )}
    </div>
  );
}
