'use client';

import { LIMITS } from '@/lib/guardrails';

interface JobSearchFormProps {
  companies: string;
  location: string;
  remote: boolean;
  keywords: string;
  onCompaniesChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onRemoteChange: (v: boolean) => void;
  onKeywordsChange: (v: string) => void;
  onSearch: () => void;
  canSearch: boolean;
  isLoading: boolean;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none';

export function JobSearchForm({
  companies,
  location,
  remote,
  keywords,
  onCompaniesChange,
  onLocationChange,
  onRemoteChange,
  onKeywordsChange,
  onSearch,
  canSearch,
  isLoading,
}: JobSearchFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-400">
          Targeted companies <span className="text-gray-600">(optional, comma separated)</span>
        </label>
        <input
          type="text"
          value={companies}
          onChange={(e) => onCompaniesChange(e.target.value)}
          placeholder="Tesla, SAP, N26"
          // Roomy cap: many short company names; the server bounds the parsed count.
          maxLength={LIMITS.shortFieldChars * LIMITS.companiesMaxItems}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="Berlin"
            maxLength={LIMITS.locationChars}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            Keywords / sector
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => onKeywordsChange(e.target.value)}
            placeholder="fintech, backend"
            maxLength={LIMITS.keywordsChars}
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={remote}
          onChange={(e) => onRemoteChange(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-white/5 accent-white"
        />
        Remote (Germany)
      </label>

      <button
        onClick={onSearch}
        disabled={!canSearch || isLoading}
        className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? 'Searching...' : 'Find jobs'}
      </button>
    </div>
  );
}
