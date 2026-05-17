'use client';

interface JobDescriptionInputProps {
  company: string;
  jobTitle: string;
  description: string;
  onCompanyChange: (v: string) => void;
  onJobTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
}

export function JobDescriptionInput({
  company,
  jobTitle,
  description,
  onCompanyChange,
  onJobTitleChange,
  onDescriptionChange,
}: JobDescriptionInputProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={company}
          onChange={(e) => onCompanyChange(e.target.value)}
          placeholder="Company"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none"
        />
        <input
          type="text"
          value={jobTitle}
          onChange={(e) => onJobTitleChange(e.target.value)}
          placeholder="Job title"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Paste the full job description here..."
        rows={14}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300 placeholder-gray-600 focus:border-white/20 focus:outline-none"
      />
    </div>
  );
}
