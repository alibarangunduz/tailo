'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/user-nav';
import { JobSearchForm } from '@/components/job-search-form';
import { JobResults } from '@/components/job-results';
import { LIMITS } from '@/lib/guardrails';
import { JobListing, JobSearchResponse, MasterCVSummary } from '@/lib/types';

const navLinkClass =
  'rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white';

export default function JobsPage() {
  const [masterCVId, setMasterCVId] = useState<string | null>(null);
  const [savedCVs, setSavedCVs] = useState<MasterCVSummary[]>([]);

  const [companies, setCompanies] = useState('');
  const [location, setLocation] = useState('');
  const [remote, setRemote] = useState(false);
  const [keywords, setKeywords] = useState('');

  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Load the saved CVs for the picker and default to the most recent, mirroring
  // the tailor page so the user does not have to re-pick it here.
  useEffect(() => {
    fetch('/api/master-cv')
      .then((res) => res.json())
      .then((cvs: MasterCVSummary[]) => {
        if (!Array.isArray(cvs) || cvs.length === 0) return;
        setSavedCVs(cvs);
        setMasterCVId(cvs[0].id);
      })
      .catch(() => {
        // ignore: the page shows a prompt to create a CV first
      });
  }, []);

  const parsedCompanies = companies
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, LIMITS.companiesMaxItems);

  const runSearch = async (page: number, append: boolean) => {
    if (!masterCVId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCVId,
          companies: parsedCompanies,
          location: location.trim(),
          remote,
          keywords: keywords.trim(),
          page,
        }),
      });
      const data = (await res.json()) as JobSearchResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || 'Search failed. Please try again.');
        return;
      }
      setJobs((prev) => (append ? [...prev, ...data.jobs] : data.jobs));
      setNextPage(data.nextPage);
      setSearched(true);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setJobs([]);
    setNextPage(null);
    runSearch(1, false);
  };

  const handleLoadMore = () => {
    if (nextPage) runSearch(nextPage, true);
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold text-white">Tailo</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/" className={navLinkClass}>
              Home
            </Link>
            <Link href="/tailor" className={navLinkClass}>
              Tailor
            </Link>
            <Link href="/history" className={navLinkClass}>
              History
            </Link>
            <Link href="/settings" className={navLinkClass}>
              Settings
            </Link>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <UserNav />
          </div>
        </nav>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Find Jobs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your targeted companies and location. Tailo ranks real listings against your
            master CV and links you straight to them.
          </p>
        </div>

        {savedCVs.length > 0 ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Match against
            </label>
            <select
              value={masterCVId ?? ''}
              onChange={(e) => setMasterCVId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-white/20 focus:outline-none"
              style={{ background: 'black' }}
            >
              {savedCVs.map((cv) => (
                <option key={cv.id} value={cv.id} className="bg-gray-900 text-white">
                  {cv.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            You need a saved master CV first.{' '}
            <Link href="/tailor" className="font-semibold underline">
              Add one on the Tailor page
            </Link>
            , then come back to search.
          </div>
        )}

        <JobSearchForm
          companies={companies}
          location={location}
          remote={remote}
          keywords={keywords}
          onCompaniesChange={setCompanies}
          onLocationChange={setLocation}
          onRemoteChange={setRemote}
          onKeywordsChange={setKeywords}
          onSearch={handleSearch}
          canSearch={Boolean(masterCVId)}
          isLoading={isLoading}
        />

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {searched && !isLoading && jobs.length === 0 && !error && (
          <p className="mt-6 text-sm text-gray-500">
            No matching jobs found. Try broadening your location, removing a company, or changing
            the keywords.
          </p>
        )}

        <div className="mt-6">
          <JobResults
            jobs={jobs}
            hasMore={Boolean(nextPage)}
            isLoading={isLoading}
            onLoadMore={handleLoadMore}
          />
        </div>
      </div>
    </div>
  );
}
