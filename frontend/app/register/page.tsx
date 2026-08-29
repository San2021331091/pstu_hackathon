'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { saveSession } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'USER' | 'AGENT'>('USER');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.register({
        name,
        phone,
        password,
        accountType,
        pin: pin || undefined,
      });
      saveSession(res.accessToken, res.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand-600">Payflow</h1>
          <p className="text-slate-500 mt-1">Get ৳100,000 in demo funds on signup.</p>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          <h2 className="text-lg font-semibold">Create account</h2>
          <div>
            <label className="label">Full name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              placeholder="01712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Account type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['USER', 'AGENT'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setAccountType(t)}
                  className={`py-2.5 rounded-lg text-sm font-medium border ${
                    accountType === t
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {t === 'USER' ? 'Regular user' : 'Agent (cash-in)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">PIN (optional)</label>
            <input
              className="input"
              inputMode="numeric"
              type="password"
              placeholder="4–6 digits, for Emergency Freeze"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              Required later to unfreeze after an emergency freeze. You can set it now or from the
              dashboard.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
          <p className="text-sm text-center text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 font-medium">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
