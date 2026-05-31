export interface ScoreBreakdown {
  technicalSkillsMatch: number;
  experienceRelevance: number;
  seniorityFit: number;
  culturalSignals: number;
}

export interface GapItem {
  requirement: string;
  status: 'missing' | 'partial' | 'strong';
  suggestion: string;
}

// A gap the user actually has covered but never added to the master CV,
// along with the real evidence they supplied for it.
export interface SupplementalDetail {
  requirement: string;
  note: string;
}

export interface StrengthItem {
  requirement: string;
  candidateEvidence: string;
}

export interface SkillCategory {
  category: string;
  items: string;
}

export interface ExperienceSubsection {
  heading: string;
  bullets: string[];
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location: string;
  dates: string;
  subsections: ExperienceSubsection[];
}

export interface ProjectEntry {
  name: string;
  technologies: string;
  description: string;
}

export interface TailoredCVContent {
  summary: string;
  skills: SkillCategory[];
  experience: ExperienceEntry[];
  education: string;
  projects: ProjectEntry[];
}

export interface MasterCVSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TailorResult {
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
  gaps: GapItem[];
  strengths: StrengthItem[];
  tailoredCV: TailoredCVContent;
  strategyNotes: string;
}

// A single ranked job from a search. `url` is the direct listing link when the
// provider supplies a usable one; when it does not, `url` is null and the client
// renders a flagged "search on the portal" fallback instead.
export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string | null;
  salary: string | null;
  // Short snippet from the provider, used in the card and the ranking call.
  summary: string;
  // 0 to 100 fit against the master CV, from the ranking pass.
  matchScore: number;
  // One concise line on why this role fits the candidate.
  whyItFits: string;
}

// The shape returned by POST /api/jobs/search.
export interface JobSearchResponse {
  jobs: JobListing[];
  // The page to request next for "Load more", or null when the source is exhausted.
  nextPage: number | null;
}
