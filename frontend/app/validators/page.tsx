'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, Validator } from '@/lib/api';

export default function ValidatorsPage() {
  const [validators, setValidators] = useState<Validator[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api
      .validators()
      .then((v) => {
        setValidators(v);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const online = validators.filter((v) => v.online).length;
  const threshold = Math.floor(validators.length / 2) + 1;

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-1">Validator network</h1>
      <p className="text-sm text-slate-500 mb-4">
        Independent nodes that vote on every finalizing transfer. A <b>2-of-3 supermajority</b> is
        required to ban a suspicious transfer — the same principle behind Ripple/Stellar payment
        consensus, not a bare 51%.
      </p>

      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Nodes online</p>
            <p className="text-2xl font-bold">
              {online}/{validators.length || 3}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Ban threshold</p>
            <p className="text-2xl font-bold">{threshold || 2}-of-{validators.length || 3}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : validators.length === 0 ? (
        <div className="card border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            No validators seeded. Run <code>npx prisma db seed</code> in the backend to create the
            three demo nodes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {validators.map((v) => (
            <div key={v.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${v.online ? 'bg-emerald-500' : 'bg-slate-300'}`}
                />
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-xs text-slate-400">
                    {v.online ? 'Online' : 'Offline'} · {v.votesCast} vote
                    {v.votesCast === 1 ? '' : 's'} cast
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  v.online ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                }`}
              >
                {v.online ? 'HEALTHY' : 'DOWN'}
              </span>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
