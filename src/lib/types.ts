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
