"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { UserNav } from "@/components/user-nav";
import { CVHeader, defaultCvHeader } from "@/lib/cv-header";
import { LIMITS } from "@/lib/guardrails";

// Fields shown in the form, in display order. Labels and hints are kept here so
// the markup stays a simple loop.
const FIELDS: {
  key: keyof CVHeader;
  label: string;
  type: string;
  placeholder: string;
  hint?: string;
}[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Ada Lovelace" },
  { key: "email", label: "Email", type: "email", placeholder: "ada@example.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+1 555-0100" },
  {
    key: "linkedin",
    label: "LinkedIn",
    type: "text",
    placeholder: "linkedin.com/in/ada",
    hint: "Without https://",
  },
  {
    key: "website",
    label: "Personal website",
    type: "text",
    placeholder: "ada.dev",
    hint: "Without https://",
  },
];

export default function SettingsPage() {
  const [form, setForm] = useState<CVHeader>(defaultCvHeader);
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">(
    "loading",
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((s) => {
        if (s && s.name) setForm(s);
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }, []);

  const update = (key: keyof CVHeader, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold text-white">Tailo</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/tailor"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              Tailor
            </Link>
            <Link
              href="/history"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              History
            </Link>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <UserNav />
          </div>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            These contact details form the header of your exported PDF. They override
            whatever is in the master CV.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={field.key}
                className="mb-1.5 block text-sm font-medium text-gray-300"
              >
                {field.label}
                {field.hint && (
                  <span className="ml-2 text-xs font-normal text-gray-600">
                    {field.hint}
                  </span>
                )}
              </label>
              <input
                id={field.key}
                type={field.type}
                value={form[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
                placeholder={field.placeholder}
                maxLength={LIMITS.shortFieldChars}
                disabled={status === "loading"}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 transition focus:border-white/30 focus:outline-none disabled:opacity-50"
              />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={status === "loading" || status === "saving"}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "saving" ? "Saving..." : "Save"}
            </button>
            {status === "saved" && (
              <span className="text-sm text-green-400">Saved</span>
            )}
            {status === "error" && (
              <span className="text-sm text-red-400">Something went wrong</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
