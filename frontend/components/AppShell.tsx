'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser, clearSession, SessionUser } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Home' },
  { href: '/send', label: 'Send' },
  { href: '/request', label: 'Request' },
  { href: '/history', label: 'History' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setUser(getUser());
    setReady(true);
  }, [router]);

  if (!ready) return null;

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-brand-600 text-lg">
            Payflow
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:block">
              {user?.name}
            </span>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-red-600">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl grid grid-cols-4">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-3 text-center text-sm font-medium ${
                  active ? 'text-brand-600' : 'text-slate-400'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
