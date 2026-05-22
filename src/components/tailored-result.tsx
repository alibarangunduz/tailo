'use client';

import { useState } from 'react';
import { SupplementalDetail, TailorResult } from '@/lib/types';
import { MatchScore } from './match-score';
import { GapAnalysis } from './gap-analysis';

// Lowercase, strip accents (Gündüz to gunduz), and join word runs with
// underscores for use in a download filename.
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

interface TailoredResultProps {
  result: TailorResult;
  company?: string;
  // Candidate name taken from the imported master CV, used for the PDF filename.
  candidateName?: string;
  onRegenerate?: (details: SupplementalDetail[]) => void;
  isRegenerating?: boolean;
}

export function TailoredResult({ result, company, candidateName, onRegenerate, isRegenerating }: TailoredResultProps) {
  const [copied, setCopied] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'error'>('idle');

  const cv = result.tailoredCV;

  const plainText = [
    cv.summary,
    '',
    'SKILLS',
    ...cv.skills.map((s) => `${s.category}: ${s.items}`),
    '',
    'EXPERIENCE',
    ...cv.experience.flatMap((e) => [
      `${e.title} | ${e.company} | ${e.location} | ${e.dates}`,
      ...e.subsections.flatMap((sub) => [
        sub.heading,
        ...sub.bullets.map((b) => `  - ${b}`),
      ]),
    ]),
    '',
    'EDUCATION',
    cv.education,
  ].join('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    setPdfState('working');
    try {
      // Dynamic import keeps @react-pdf/renderer out of the SSR and initial bundle.
      const { generateCvPdf } = await import('@/lib/cv-pdf');
      const blob = await generateCvPdf(result);
      const url = URL.createObjectURL(blob);
      // Filename: name_cv_year_company, e.g. ali_baran_gunduz_cv_2026_tesla.pdf
      const parts = [
        slugify(candidateName || ''),
        'cv',
        String(new Date().getFullYear()),
        slugify(company || ''),
      ].filter(Boolean);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${parts.join('_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfState('idle');
    } catch {
      setPdfState('error');
      setTimeout(() => setPdfState('idle'), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <MatchScore score={result.matchScore} breakdown={result.scoreBreakdown} />

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Tailored CV</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/20"
            >
              {copied ? 'Copied!' : 'Copy text'}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfState === 'working'}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pdfState === 'working'
                ? 'Generating...'
                : pdfState === 'error'
                  ? 'Failed, retry'
                  : 'Download PDF'}
            </button>
          </div>
        </div>

        <div className="space-y-5 text-sm text-gray-300">
          <p className="leading-relaxed">{cv.summary}</p>

          {cv.skills.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Skills</h3>
              <div className="space-y-1">
                {cv.skills.map((s, i) => (
                  <p key={i}>
                    <span className="font-medium text-white">{s.category}:</span> {s.items}
                  </p>
                ))}
              </div>
            </div>
          )}

          {cv.experience.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Experience</h3>
              <div className="space-y-4">
                {cv.experience.map((e, i) => (
                  <div key={i}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-white">{e.title}</span>
                      <span className="text-gray-400">{e.company}</span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-500">{e.location}</span>
                      <span className="ml-auto text-xs text-gray-500">{e.dates}</span>
                    </div>
                    {e.subsections.map((sub, j) => (
                      <div key={j} className="mt-2">
                        {sub.heading && (
                          <p className="mb-1 text-xs font-medium text-gray-400">{sub.heading}</p>
                        )}
                        <ul className="space-y-1 pl-4">
                          {sub.bullets.map((b, k) => (
                            <li key={k} className="list-disc text-gray-300">{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {cv.education && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Education</h3>
              <p>{cv.education}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowStrategy(!showStrategy)}
          className="mt-6 w-full rounded-lg border border-white/10 px-4 py-2 text-left text-xs text-gray-400 transition hover:border-white/20 hover:text-gray-300"
        >
          {showStrategy ? 'Hide' : 'Show'} strategy notes
        </button>
        {showStrategy && (
          <p className="mt-3 rounded-lg bg-white/5 p-4 text-xs leading-relaxed text-gray-400">
            {result.strategyNotes}
          </p>
        )}
      </div>

      <GapAnalysis
        gaps={result.gaps}
        strengths={result.strengths}
        onRegenerate={onRegenerate}
        isRegenerating={isRegenerating}
      />
    </div>
  );
}
