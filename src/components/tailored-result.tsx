'use client';

import { useEffect, useState } from 'react';
import { SupplementalDetail, TailorResult } from '@/lib/types';
import { CVHeader, defaultCvHeader } from '@/lib/cv-header';
import { MatchScore } from './match-score';
import { GapAnalysis } from './gap-analysis';
import { CvEditor } from './cv-editor';

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
  onRegenerate?: (details: SupplementalDetail[]) => void;
  isRegenerating?: boolean;
}

export function TailoredResult({ result, company, onRegenerate, isRegenerating }: TailoredResultProps) {
  const [copied, setCopied] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'error'>('idle');
  // Roles whose company name was cut off on its one-line header in the last export.
  const [truncatedHeaders, setTruncatedHeaders] = useState<string[]>([]);
  // Contact header for the exported PDF, configured on the settings page.
  // Falls back to the default constant until the fetch resolves.
  const [header, setHeader] = useState<CVHeader>(defaultCvHeader);
  // Editable copy of the generated CV. Copy text and the PDF export read from
  // this draft, so the user can fix wording before exporting.
  const [cv, setCv] = useState(result.tailoredCV);
  const [editing, setEditing] = useState(false);
  // A new result (e.g. after Regenerate) replaces the draft. Adjusting state
  // during render on prop change, per the React docs, avoids an extra effect pass.
  const [source, setSource] = useState(result);
  if (source !== result) {
    setSource(result);
    setCv(result.tailoredCV);
    setEditing(false);
  }
  const edited = cv !== result.tailoredCV;

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((s) => {
        if (s && s.name) setHeader(s);
      })
      .catch(() => {
        // ignore: fall back to the default header
      });
  }, []);

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
      const { fitCvPdf } = await import('@/lib/cv-pdf');
      const fit = await fitCvPdf({ ...result, tailoredCV: cv }, header);
      const blob = fit.blob;
      setTruncatedHeaders(fit.truncatedHeaders);
      const url = URL.createObjectURL(blob);
      // Filename: name_cv_year_company, e.g. ali_baran_gunduz_cv_2026_tesla.pdf
      // The name is the CV header name (what is printed on the document), not
      // the contact blob from the master CV first line.
      const parts = [
        slugify(header.name),
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
            {edited && (
              <button
                onClick={() => setCv(result.tailoredCV)}
                className="rounded-lg px-3 py-1.5 text-xs text-gray-400 transition hover:text-gray-200"
              >
                Reset edits
              </button>
            )}
            <button
              onClick={() => setEditing(!editing)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/20"
            >
              {editing ? 'Done editing' : 'Edit'}
            </button>
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

        {truncatedHeaders.length > 0 && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <p>
              Each role header is kept to one line in the PDF, so the company name was shortened
              with &quot;...&quot; for: {truncatedHeaders.join('; ')}. Click Edit to shorten the
              company or job title, then download again.
            </p>
            <button
              onClick={() => setTruncatedHeaders([])}
              className="text-amber-200/70 transition hover:text-amber-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {editing ? (
          <CvEditor cv={cv} onChange={setCv} />
        ) : (
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
        )}

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
