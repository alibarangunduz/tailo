// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { CvEditor } from '@/components/cv-editor';
import type { TailoredCVContent } from '@/lib/types';
import { sampleResult } from '../fixtures/sample-cv';

afterEach(cleanup);

// Renders the editor as tailored-result.tsx does: controlled, with the latest
// CV reported through `onChange`.
function setup() {
  const onChange = vi.fn<(cv: TailoredCVContent) => void>();
  function Host() {
    const [cv, setCv] = useState(sampleResult().tailoredCV);
    return (
      <CvEditor
        cv={cv}
        onChange={(next) => {
          onChange(next);
          setCv(next);
        }}
      />
    );
  }
  render(<Host />);
  const latest = () => onChange.mock.calls.at(-1)![0];
  return { onChange, latest };
}

describe('CvEditor', () => {
  it('shows the generated CV in editable fields', () => {
    setup();
    expect(screen.getByDisplayValue('Northwind Payments GmbH')).toBeTruthy();
    expect(screen.getByDisplayValue('March 2022 – Present')).toBeTruthy();
    expect(screen.getByDisplayValue('Built a TypeScript SDK used by 30 merchant integrations.')).toBeTruthy();
  });

  it('edits the summary', () => {
    const { latest } = setup();
    const summary = screen.getByDisplayValue(/^Senior backend engineer with six years/);
    fireEvent.change(summary, { target: { value: 'New summary' } });
    expect(latest().summary).toBe('New summary');
  });

  it('edits one role without touching the others', () => {
    const { latest } = setup();
    fireEvent.change(screen.getByDisplayValue('Contoso Analytics'), {
      target: { value: 'Contoso' },
    });
    expect(latest().experience[1].company).toBe('Contoso');
    expect(latest().experience[0]).toEqual(sampleResult().tailoredCV.experience[0]);
  });

  it('adds and removes bullets', () => {
    const { latest } = setup();
    fireEvent.click(screen.getAllByText('+ Add bullet')[0]);
    expect(latest().experience[0].subsections[0].bullets).toHaveLength(4);

    fireEvent.click(screen.getAllByLabelText('Remove bullet')[0]);
    const bullets = latest().experience[0].subsections[0].bullets;
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe('Built a TypeScript SDK used by 30 merchant integrations.');
  });

  it('removes a role and a skill category', () => {
    const { latest } = setup();
    fireEvent.click(screen.getAllByText('Remove role')[0]);
    expect(latest().experience.map((e) => e.company)).toEqual(['Contoso Analytics']);

    fireEvent.click(screen.getAllByLabelText('Remove skill category')[0]);
    expect(latest().skills.map((s) => s.category)).toEqual(['Data', 'Cloud']);
  });

  it('hides the projects section when there are none', () => {
    const { latest } = setup();
    expect(screen.getByText('Projects')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove project'));
    expect(latest().projects).toEqual([]);
    expect(screen.queryByText('Projects')).toBeNull();
  });
});
