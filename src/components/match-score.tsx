'use client';

import { ScoreBreakdown } from '@/lib/types';

interface MatchScoreProps {
  score: number;
  breakdown: ScoreBreakdown;
}

const scoreColor = (n: number) =>
  n >= 75 ? 'text-green-400' : n >= 50 ? 'text-yellow-400' : 'text-red-400';

const barColor = (n: number) =>
  n >= 75 ? 'bg-green-500' : n >= 50 ? 'bg-yellow-500' : 'bg-red-500';

const labels: Record<keyof ScoreBreakdown, string> = {
  technicalSkillsMatch: 'Technical Skills',
  experienceRelevance: 'Experience Relevance',
  seniorityFit: 'Seniority Fit',
  culturalSignals: 'Cultural Signals',
};

export function MatchScore({ score, breakdown }: MatchScoreProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center gap-4">
        <span className={`text-5xl font-bold ${scoreColor(score)}`}>{score}</span>
        <div>
          <p className="text-sm text-gray-400">Match Score</p>
          <p className="text-xs text-gray-500">out of 100</p>
        </div>
      </div>
      <div className="space-y-3">
        {(Object.keys(labels) as (keyof ScoreBreakdown)[]).map((key) => {
          const raw = breakdown[key];
          // The model occasionally omits a sub-score. Treat a missing or
          // out-of-range value as "no data" instead of a misleading full bar.
          const hasValue = typeof raw === 'number' && Number.isFinite(raw);
          const value = hasValue ? Math.max(0, Math.min(100, raw)) : 0;
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs text-gray-400">
                <span>{labels[key]}</span>
                <span>{hasValue ? value : '—'}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10">
                <div
                  className={`h-1.5 rounded-full ${barColor(value)} transition-all duration-700`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
