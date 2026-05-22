'use client';

import { useState } from 'react';
import { GapItem, StrengthItem, SupplementalDetail } from '@/lib/types';

interface GapAnalysisProps {
  gaps: GapItem[];
  strengths: StrengthItem[];
  onRegenerate?: (details: SupplementalDetail[]) => void;
  isRegenerating?: boolean;
}

const statusStyles: Record<GapItem['status'], string> = {
  strong: 'bg-green-500/20 text-green-300 border-green-500/30',
  partial: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  missing: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export function GapAnalysis({ gaps, strengths, onRegenerate, isRegenerating }: GapAnalysisProps) {
  // Notes the user adds for gaps they actually have covered. Keyed by requirement.
  const [notes, setNotes] = useState<Record<string, string>>({});

  const fillableGaps = gaps.filter((g) => g.status !== 'strong');

  const setNote = (requirement: string, value: string) => {
    setNotes((prev) => ({ ...prev, [requirement]: value }));
  };

  const filledDetails: SupplementalDetail[] = fillableGaps
    .map((g) => ({ requirement: g.requirement, note: (notes[g.requirement] || '').trim() }))
    .filter((d) => d.note);

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
          <h3 className="mb-1 text-sm font-semibold text-gray-300">Gap Analysis</h3>
          {onRegenerate && fillableGaps.length > 0 && (
            <p className="mb-3 text-xs text-gray-500">
              Already have one of these but left it off your master CV? Add the real detail
              below and regenerate. Tailo only uses what you actually provide.
            </p>
          )}
          <div className="space-y-2">
            {gaps.map((g, i) => {
              const canFill = onRegenerate && g.status !== 'strong';
              return (
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
                  {canFill && (
                    <textarea
                      value={notes[g.requirement] || ''}
                      onChange={(e) => setNote(g.requirement, e.target.value)}
                      placeholder="If you actually have this, describe it (where, when, what you did)"
                      rows={2}
                      className="mt-2 w-full resize-y rounded-md border border-white/10 bg-gray-950/50 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:border-white/30 focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {onRegenerate && fillableGaps.length > 0 && (
            <button
              onClick={() => onRegenerate(filledDetails)}
              disabled={isRegenerating || filledDetails.length === 0}
              className="mt-4 w-full rounded-lg bg-white px-4 py-2 text-xs font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRegenerating
                ? 'Regenerating...'
                : filledDetails.length === 0
                  ? 'Add a detail above to regenerate'
                  : `Regenerate with ${filledDetails.length} detail${filledDetails.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
