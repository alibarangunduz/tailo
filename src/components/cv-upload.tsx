"use client";

import { useEffect, useRef, useState } from "react";
import { MasterCVSummary } from "@/lib/types";
import { LIMITS, validateUpload } from "@/lib/guardrails";

interface CVUploadProps {
  value: string;
  onChange: (text: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  onSave: (name: string, content: string) => Promise<void>;
  isSaved: boolean;
  savedCVs: MasterCVSummary[];
  selectedId: string | null;
  onSelectCV: (id: string) => void;
  onNewCV: () => void;
  onDeleteCV: (id: string) => Promise<void>;
}

export function CVUpload({
  value,
  onChange,
  name,
  onNameChange,
  onSave,
  isSaved,
  savedCVs,
  selectedId,
  onSelectCV,
  onNewCV,
  onDeleteCV,
}: CVUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    // Client-side guardrail: reject non-PDF or oversized files before upload.
    // The server re-validates; this just saves a round-trip and gives feedback.
    const check = validateUpload(file);
    if (!check.ok) {
      setUploadError(check.error);
      e.target.value = "";
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/master-cv/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (res.ok && data.content) {
      // An uploaded PDF is a brand new CV: reset any saved selection and
      // name it after the file (minus the .pdf extension).
      onNewCV();
      onChange(data.content);
      onNameChange(file.name.replace(/\.pdf$/i, ""));
    } else {
      setUploadError(data.error || "Upload failed.");
    }
    setUploading(false);
    e.target.value = ""; // allow re-uploading the same file
  };

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(name, value);
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const saveLabel = saving
    ? "Saving..."
    : justSaved
      ? "Saved!"
      : isSaved
        ? "Update"
        : "Save";

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id) {
      onSelectCV(id);
    } else {
      onNewCV();
    }
  };

  const selectedCV = savedCVs.find((cv) => cv.id === selectedId);

  const confirmDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    await onDeleteCV(selectedId);
    setDeleting(false);
    setConfirmOpen(false);
  };

  // Close the delete confirmation when clicking outside of it.
  useEffect(() => {
    if (!confirmOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        !deleting &&
        confirmRef.current &&
        !confirmRef.current.contains(e.target as Node)
      ) {
        setConfirmOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [confirmOpen, deleting]);

  return (
    <div className="space-y-3">
      {savedCVs.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedId ?? ""}
            onChange={handleSelectChange}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white [color-scheme:dark] focus:border-white/20 focus:outline-none"
            style={{ background: "black" }}
          >
            {savedCVs.map((cv) => (
              <option
                key={cv.id}
                value={cv.id}
                className="bg-gray-900 text-white"
              >
                {cv.name}
              </option>
            ))}
            <option value="" className="bg-gray-900 text-white">
              + New CV
            </option>
          </select>
          <div className="relative shrink-0" ref={confirmRef}>
            <button
              type="button"
              onClick={() => setConfirmOpen((open) => !open)}
              disabled={!selectedId}
              className="cursor-pointer rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 transition hover:border-red-500/40 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
            {confirmOpen && (
              <div className="absolute top-full right-0 z-20 mt-2 w-64 rounded-lg border border-white/10 bg-gray-900 p-3 shadow-xl">
                <p className="text-xs leading-relaxed text-gray-400">
                  Delete{" "}
                  <span className="font-medium text-gray-200">
                    {selectedCV?.name ?? "this CV"}
                  </span>
                  ? This also removes every tailored CV generated from it (its
                  History entries) and cannot be undone.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    disabled={deleting}
                    className="cursor-pointer rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-300 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="cursor-pointer rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="CV name"
          maxLength={LIMITS.shortFieldChars}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition hover:border-white/20 hover:text-gray-300 disabled:opacity-50"
        >
          {uploading ? "Parsing..." : "Upload PDF"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/20 disabled:opacity-50"
        >
          {saveLabel}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {uploadError && (
        <p className="text-xs text-red-400">{uploadError}</p>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your master CV here, or upload a PDF above..."
        rows={14}
        maxLength={LIMITS.cvChars}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300 placeholder-gray-600 focus:border-white/20 focus:outline-none"
      />
    </div>
  );
}
