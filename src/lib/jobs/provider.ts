// Provider-neutral job retrieval contract. The rest of the app (ranking, route,
// UI) depends only on these types, never on a specific job board, so swapping the
// source later (Adzuna to JSearch, etc.) is a single-file change in this folder.

// A normalized search request. `companies` is a list of employer filters; an
// empty list means a broad search by keywords and location alone.
export interface JobQuery {
  keywords: string; // skills, sector, and title terms (the "what")
  location?: string; // city or region (the "where")
  remote?: boolean; // bias toward remote roles when true
  companies: string[]; // targeted employers; empty = broad search
  page: number; // 1-based page for "Load more"
  resultsPerPage: number; // listings to request per page
}

// One raw listing as returned by a provider, before CV ranking. `url` is null
// when the provider gives no usable direct link, in which case the UI shows a
// flagged fallback. `salary` is a preformatted display string or null.
export interface RawJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string | null;
  salary: string | null;
  description: string;
}

export interface JobProviderResult {
  jobs: RawJob[];
  hasMore: boolean; // whether another page is likely available
}

export interface JobProvider {
  search(query: JobQuery): Promise<JobProviderResult>;
}

// Thrown when a provider cannot run because its credentials are absent. The route
// maps this to a clear, actionable error instead of a generic 500.
export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}
