import { JobListing } from '@/lib/types';
import { JobCard } from '@/components/job-card';

interface JobResultsProps {
  jobs: JobListing[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}

export function JobResults({ jobs, hasMore, isLoading, onLoadMore }: JobResultsProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
