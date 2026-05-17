'use client';

import { GapItem, StrengthItem } from '@/lib/types';

interface GapAnalysisProps {
  gaps: GapItem[];
  strengths: StrengthItem[];
}

const statusStyles: Record<GapItem['status'], string> = {
  strong: 'bg-green-500/20 text-green-300 border-green-500/30',
  partial: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  missing: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export function GapAnalysis({ gaps, strengths }: GapAnalysisProps) {
  return (
    <div className="space-y-6">
      {strengths.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-green-400">Strengths</h3>
          <div className="space-y-2">
            {strengths.map((s, i) => (
              <div key={i} className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                <p className="text-sm font-medium text-white">{s.requirement}</p>
                <p className="mt-1 text-xs text-gray-400">{s.candidateEvidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {gaps.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-300">Gap Analysis</h3>
          <div className="space-y-2">
            {gaps.map((g, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white">{g.requirement}</p>
                  <span className={`shrink-0 rounded border px-2 py-0.5 text-xs ${statusStyles[g.status]}`}>
                    {g.status}
                  </span>
                </div>
                {g.status !== 'strong' && (
                  <p className="mt-1 text-xs text-gray-400">{g.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
