'use client';

import { useState } from 'react';
import { useCompletion } from '@ai-sdk/react';
import { CVUpload } from '@/components/cv-upload';
import { JobDescriptionInput } from '@/components/job-description-input';
import { TailoredResult } from '@/components/tailored-result';
import { TailorResult } from '@/lib/types';

export default function TailorPage() {
  const [masterCV, setMasterCV] = useState('');
  const [masterCVId, setMasterCVId] = useState<string | null>(null);
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<TailorResult | null>(null);
  const [parseError, setParseError] = useState(false);

  const { complete, isLoading, completion } = useCompletion({
    api: '/api/tailor',
    streamProtocol: 'text',
    onError: () => setParseError(true),
    onFinish: (_prompt, completion) => {
      try {
        const cleaned = completion
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        const parsed = JSON.parse(cleaned);
        setResult(parsed);
        setParseError(false);
      } catch {
        setParseError(true);
      }
    },
  });

  const handleSaveCV = async (name: string, content: string) => {
    const res = await fetch('/api/master-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    });
    const data = await res.json();
    setMasterCVId(data.id);
  };

  const handleTailor = () => {
    setResult(null);
    setParseError(false);
    complete('', {
      body: { masterCV, masterCVId, jobDescription, company, jobTitle },
    });
  };

  const canTailor = masterCV.trim() && company.trim() && jobTitle.trim() && jobDescription.trim();

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Tailor CV</h1>
          <p className="mt-1 text-sm text-gray-500">
            Paste your master CV and the target job description. Claude will do the rest.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-400">Master CV</h2>
              <CVUpload value={masterCV} onChange={setMasterCV} onSave={handleSaveCV} />
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-400">Job Description</h2>
              <JobDescriptionInput
                company={company}
                jobTitle={jobTitle}
                description={jobDescription}
                onCompanyChange={setCompany}
                onJobTitleChange={setJobTitle}
                onDescriptionChange={setJobDescription}
              />
            </div>
            <button
              onClick={handleTailor}
              disabled={!canTailor || isLoading}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? 'Tailoring...' : 'Tailor CV'}
            </button>
          </div>

          <div>
            {isLoading && !result && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <p className="mb-3 text-sm font-semibold text-gray-400">Generating...</p>
                <pre className="max-h-96 overflow-auto text-xs text-gray-500 whitespace-pre-wrap">
                  {completion}
                </pre>
              </div>
            )}
            {parseError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
                <p className="text-sm text-red-400">
                  Could not parse the response. Raw output:
                </p>
                <pre className="mt-3 max-h-96 overflow-auto text-xs text-gray-400 whitespace-pre-wrap">
                  {completion}
                </pre>
              </div>
            )}
            {result && <TailoredResult result={result} company={company} />}
          </div>
        </div>
      </div>
    </div>
  );
}
