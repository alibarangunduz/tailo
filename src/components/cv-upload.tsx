'use client';

import { useRef, useState } from 'react';

interface CVUploadProps {
  value: string;
  onChange: (text: string) => void;
  onSave: (name: string, content: string) => Promise<void>;
}

export function CVUpload({ value, onChange, onSave }: CVUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvName, setCvName] = useState('My CV');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('name', file.name.replace('.pdf', ''));
    const res = await fetch('/api/master-cv/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (data.content) onChange(data.content);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(cvName, value);
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={cvName}
          onChange={(e) => setCvName(e.target.value)}
          placeholder="CV name"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition hover:border-white/20 hover:text-gray-300 disabled:opacity-50"
        >
          {uploading ? 'Parsing...' : 'Upload PDF'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/20 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your master CV here, or upload a PDF above..."
        rows={14}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300 placeholder-gray-600 focus:border-white/20 focus:outline-none"
      />
    </div>
  );
}
