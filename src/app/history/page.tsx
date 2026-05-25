import { prisma } from '@/lib/db';
import Link from 'next/link';
import { requireUserIdOrRedirect } from '@/lib/session';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/user-nav';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const userId = await requireUserIdOrRedirect('/history');
  const history = await prisma.tailoredCV.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { masterCV: { select: { name: true } } },
  });

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold text-white">Tailo</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/tailor"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              Tailor
            </Link>
            <Link
              href="/settings"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              Settings
            </Link>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <UserNav />
          </div>
        </nav>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">History</h1>
            <p className="mt-1 text-sm text-gray-500">{history.length} tailored versions</p>
          </div>
          <Link
            href="/tailor"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
          >
            New
          </Link>
        </div>

        {history.length === 0 ? (
          <p className="text-center text-sm text-gray-600">No tailored CVs yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">
                      {item.jobTitle} <span className="text-gray-400">at</span> {item.company}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      From: {item.masterCV.name} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-3 py-1 text-sm font-bold ${
                      item.matchScore >= 75
                        ? 'bg-green-500/20 text-green-300'
                        : item.matchScore >= 50
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {item.matchScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
