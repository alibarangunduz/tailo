import { JobListing } from '@/lib/types';

// Colors the match badge by strength, reusing the app's score palette feel.
function scoreColor(score: number): string {
  if (score >= 75) return 'bg-green-500/15 text-green-300 ring-green-500/30';
  if (score >= 50) return 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30';
  return 'bg-gray-500/15 text-gray-300 ring-gray-500/30';
}

// When a listing has no direct URL, point the user at a portal search for the
// same role so they can still find it quickly.
function fallbackSearchUrl(job: JobListing): string {
  const q = encodeURIComponent(`${job.title} ${job.company} jobs`);
  return `https://www.google.com/search?q=${q}`;
}

export function JobCard({ job }: { job: JobListing }) {
  const hasDirectLink = Boolean(job.url);
  const href = job.url ?? fallbackSearchUrl(job);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{job.title}</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {job.company}
            {job.location ? ` · ${job.location}` : ''}
            {job.salary ? ` · ${job.salary}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${scoreColor(job.matchScore)}`}
        >
          {job.matchScore}% match
        </span>
      </div>

      {job.whyItFits && <p className="mt-2 text-xs text-gray-300">{job.whyItFits}</p>}

      <div className="mt-3 flex items-center justify-between">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
        >
          {hasDirectLink ? 'View listing' : 'Search on the portal'}
        </a>
        {!hasDirectLink && (
          <span className="text-xs text-amber-400/80">Direct link not found</span>
        )}
      </div>
    </div>
  );
}
