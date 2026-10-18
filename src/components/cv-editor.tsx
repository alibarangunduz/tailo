'use client';

import { useLayoutEffect, useRef } from 'react';
import {
  ExperienceEntry,
  ExperienceSubsection,
  ProjectEntry,
  SkillCategory,
  TailoredCVContent,
} from '@/lib/types';

// Inline editor for the generated CV. Edits stay on the client: they feed the
// PDF export and "Copy text" directly, nothing is sent back to the server.

// Field look without a width, so a field can set its own width without two
// conflicting width utilities (w-full would otherwise beat a fixed w-40).
const fieldClass =
  'rounded-md border border-white/10 bg-black/20 px-2 py-1 text-sm text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none';
const inputClass = `w-full ${fieldClass}`;
const labelClass = 'mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500';
const smallButtonClass = 'text-xs text-gray-500 transition hover:text-gray-300';

// Replaces one item of an array, returning a new array.
function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

// Textarea that grows with its content so long bullets stay readable.
function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      // min-w-0 lets it shrink beside other fields in a flex row instead of
      // being squeezed to nothing.
      className={`${inputClass} min-w-0 resize-none overflow-hidden leading-relaxed`}
    />
  );
}

interface CvEditorProps {
  cv: TailoredCVContent;
  onChange: (cv: TailoredCVContent) => void;
}

export function CvEditor({ cv, onChange }: CvEditorProps) {
  const set = <K extends keyof TailoredCVContent>(key: K, value: TailoredCVContent[K]) =>
    onChange({ ...cv, [key]: value });

  const setSkill = (i: number, patch: Partial<SkillCategory>) =>
    set('skills', replaceAt(cv.skills, i, { ...cv.skills[i], ...patch }));

  const setEntry = (i: number, patch: Partial<ExperienceEntry>) =>
    set('experience', replaceAt(cv.experience, i, { ...cv.experience[i], ...patch }));

  const setSubsection = (i: number, j: number, patch: Partial<ExperienceSubsection>) => {
    const entry = cv.experience[i];
    setEntry(i, {
      subsections: replaceAt(entry.subsections, j, { ...entry.subsections[j], ...patch }),
    });
  };

  const setProject = (i: number, patch: Partial<ProjectEntry>) =>
    set('projects', replaceAt(cv.projects, i, { ...cv.projects[i], ...patch }));

  return (
    <div className="space-y-6 text-sm text-gray-300">
      <div>
        <h3 className={labelClass}>Summary</h3>
        <AutoTextarea value={cv.summary} onChange={(v) => set('summary', v)} />
      </div>

      <div>
        <h3 className={labelClass}>Skills</h3>
        <div className="space-y-2">
          {cv.skills.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                value={s.category}
                onChange={(e) => setSkill(i, { category: e.target.value })}
                placeholder="Category"
                className={`${fieldClass} w-40 shrink-0 font-medium`}
              />
              <AutoTextarea
                value={s.items}
                onChange={(v) => setSkill(i, { items: v })}
                placeholder="Comma-separated skills"
              />
              <button
                onClick={() => set('skills', removeAt(cv.skills, i))}
                className={`${smallButtonClass} pt-1.5`}
                aria-label="Remove skill category"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className={labelClass}>Experience</h3>
        <div className="space-y-5">
          {cv.experience.map((e, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-white/10 p-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={e.title}
                  onChange={(ev) => setEntry(i, { title: ev.target.value })}
                  placeholder="Job title"
                  className={`${inputClass} font-semibold`}
                />
                <input
                  value={e.company}
                  onChange={(ev) => setEntry(i, { company: ev.target.value })}
                  placeholder="Company"
                  className={inputClass}
                />
                <input
                  value={e.location}
                  onChange={(ev) => setEntry(i, { location: ev.target.value })}
                  placeholder="Location"
                  className={inputClass}
                />
                <input
                  value={e.dates}
                  onChange={(ev) => setEntry(i, { dates: ev.target.value })}
                  placeholder="Dates"
                  className={inputClass}
                />
              </div>

              {e.subsections.map((sub, j) => (
                <div key={j} className="space-y-1.5 pl-2">
                  <input
                    value={sub.heading}
                    onChange={(ev) => setSubsection(i, j, { heading: ev.target.value })}
                    placeholder="Subsection heading (optional)"
                    className={`${inputClass} text-xs text-gray-400`}
                  />
                  {sub.bullets.map((b, k) => (
                    <div key={k} className="flex items-start gap-2 pl-2">
                      <span className="pt-1.5 text-gray-500">•</span>
                      <AutoTextarea
                        value={b}
                        onChange={(v) =>
                          setSubsection(i, j, { bullets: replaceAt(sub.bullets, k, v) })
                        }
                      />
                      <button
                        onClick={() =>
                          setSubsection(i, j, { bullets: removeAt(sub.bullets, k) })
                        }
                        className={`${smallButtonClass} pt-1.5`}
                        aria-label="Remove bullet"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setSubsection(i, j, { bullets: [...sub.bullets, ''] })}
                    className={`${smallButtonClass} pl-6`}
                  >
                    + Add bullet
                  </button>
                </div>
              ))}

              <button
                onClick={() => set('experience', removeAt(cv.experience, i))}
                className={smallButtonClass}
              >
                Remove role
              </button>
            </div>
          ))}
        </div>
      </div>

      {cv.projects.length > 0 && (
        <div>
          <h3 className={labelClass}>Projects</h3>
          <div className="space-y-3">
            {cv.projects.map((p, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    value={p.name}
                    onChange={(e) => setProject(i, { name: e.target.value })}
                    placeholder="Project name"
                    className={`${inputClass} font-medium`}
                  />
                  <input
                    value={p.technologies}
                    onChange={(e) => setProject(i, { technologies: e.target.value })}
                    placeholder="Technologies"
                    className={inputClass}
                  />
                  <button
                    onClick={() => set('projects', removeAt(cv.projects, i))}
                    className={smallButtonClass}
                    aria-label="Remove project"
                  >
                    ✕
                  </button>
                </div>
                <AutoTextarea
                  value={p.description}
                  onChange={(v) => setProject(i, { description: v })}
                  placeholder="One sentence description"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className={labelClass}>Education</h3>
        <p className="mb-1 text-xs text-gray-600">Separate entries with &quot; | &quot;.</p>
        <AutoTextarea value={cv.education} onChange={(v) => set('education', v)} />
      </div>
    </div>
  );
}
