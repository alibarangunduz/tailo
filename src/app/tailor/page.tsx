"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCompletion } from "@ai-sdk/react";
import { CVUpload } from "@/components/cv-upload";
import { JobDescriptionInput } from "@/components/job-description-input";
import { TailoredResult } from "@/components/tailored-result";
import { Logo } from "@/components/logo";
import { MasterCVSummary, TailorResult } from "@/lib/types";

export default function TailorPage() {
  const [masterCV, setMasterCV] = useState("");
  const [masterCVId, setMasterCVId] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<TailorResult | null>(null);
  const [parseError, setParseError] = useState(false);
  const [cvName, setCvName] = useState("My CV");
  const [cvLoaded, setCvLoaded] = useState(false);
  const [savedCVs, setSavedCVs] = useState<MasterCVSummary[]>([]);

  const { complete, isLoading, completion } = useCompletion({
    api: "/api/tailor",
    streamProtocol: "text",
    onError: () => setParseError(true),
    onFinish: (_prompt, completion) => {
      try {
        const cleaned = completion
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const parsed = JSON.parse(cleaned);
        setResult(parsed);
        setParseError(false);
      } catch {
        setParseError(true);
      }
    },
  });

  // Load a saved master CV by id, pulling in its full content.
  const loadCV = async (id: string) => {
    try {
      const res = await fetch(`/api/master-cv/${id}`);
      if (!res.ok) return;
      const cv = await res.json();
      if (cv && cv.id) {
        setMasterCV(cv.content);
        setMasterCVId(cv.id);
        setCvName(cv.name);
        setCvLoaded(true);
      }
    } catch {
      // ignore: user can still paste or upload a CV
    }
  };

  // Fetch the list of saved CVs for the picker.
  const refreshCVList = async (): Promise<MasterCVSummary[]> => {
    try {
      const res = await fetch("/api/master-cv");
      const cvs = await res.json();
      if (Array.isArray(cvs)) {
        setSavedCVs(cvs);
        return cvs;
      }
    } catch {
      // ignore: picker simply stays empty
    }
    return [];
  };

  // On load, fetch saved CVs and auto-select the most recent one so it does
  // not need re-uploading.
  useEffect(() => {
    fetch("/api/master-cv")
      .then((res) => res.json())
      .then((cvs: MasterCVSummary[]) => {
        if (!Array.isArray(cvs) || cvs.length === 0) return;
        setSavedCVs(cvs);
        loadCV(cvs[0].id);
      })
      .catch(() => {
        // ignore: user can still paste or upload a CV
      });
  }, []);

  const handleSaveCV = async (name: string, content: string) => {
    const res = await fetch("/api/master-cv", {
      method: masterCVId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        masterCVId ? { id: masterCVId, name, content } : { name, content },
      ),
    });
    const data = await res.json();
    setMasterCVId(data.id);
    setCvLoaded(true);
    refreshCVList();
  };

  // Switch to a different previously saved CV.
  const handleSelectCV = (id: string) => {
    loadCV(id);
  };

  // Clear the form to start a fresh CV from scratch.
  const handleNewCV = () => {
    setMasterCV("");
    setCvName("My CV");
    setMasterCVId(null);
    setCvLoaded(false);
  };

  // Delete a saved CV, then fall back to the most recent remaining one
  // (or a blank form if none are left).
  const handleDeleteCV = async (id: string) => {
    await fetch(`/api/master-cv/${id}`, { method: "DELETE" });
    const cvs = await refreshCVList();
    if (cvs.length > 0) {
      loadCV(cvs[0].id);
    } else {
      handleNewCV();
    }
  };

  const handleTailor = () => {
    setResult(null);
    setParseError(false);
    complete("", {
      body: { masterCV, masterCVId, jobDescription, company, jobTitle },
    });
  };

  const canTailor =
    masterCV.trim() &&
    company.trim() &&
    jobTitle.trim() &&
    jobDescription.trim();

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <Link
            href="/"
            className="flex items-center gap-2 transition hover:opacity-80"
          >
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold text-white">Tailo</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/history"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              History
            </Link>
          </div>
        </nav>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Tailor CV</h1>
          <p className="mt-1 text-sm text-gray-500">
            Paste your master CV and the target job description. Tailo will do
            the rest.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-400">
                  Master CV
                </h2>
                {cvLoaded && (
                  <span className="text-xs text-green-400">
                    Using your saved master CV
                  </span>
                )}
              </div>
              <CVUpload
                value={masterCV}
                onChange={setMasterCV}
                name={cvName}
                onNameChange={setCvName}
                onSave={handleSaveCV}
                isSaved={cvLoaded}
                savedCVs={savedCVs}
                selectedId={masterCVId}
                onSelectCV={handleSelectCV}
                onNewCV={handleNewCV}
                onDeleteCV={handleDeleteCV}
              />
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-400">
                Job Description
              </h2>
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
              {isLoading ? "Tailoring..." : "Tailor CV"}
            </button>
          </div>

          <div>
            {isLoading && !result && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <p className="mb-3 text-sm font-semibold text-gray-400">
                  Generating...
                </p>
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
