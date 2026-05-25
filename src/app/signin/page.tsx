'use client';

import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/logo';

function SignInButton() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/tailor';
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={() => {
        setLoading(true);
        signIn('google', { callbackUrl });
      }}
      disabled={loading}
      className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? 'Redirecting...' : 'Continue with Google'}
    </button>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="text-xl font-semibold text-white">Tailo</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Sign in</h1>
        <p className="mt-2 mb-8 text-sm text-gray-400">
          Sign in to tailor your CV, save versions, and manage your settings.
        </p>
        <Suspense fallback={null}>
          <SignInButton />
        </Suspense>
      </div>
    </div>
  );
}
