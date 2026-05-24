// Contact header for the exported CV PDF. Single-user MVP: the live values are
// stored in the Settings table and edited from the settings page. The constant
// below seeds an empty Settings row and is the fallback when none exists yet.

export interface CVHeader {
  name: string;
  linkedin: string;
  phone: string;
  website: string;
  email: string;
}

export const defaultCvHeader: CVHeader = {
  name: 'Ali Baran Gündüz',
  linkedin: 'linkedin.com/in/alibarangunduz',
  phone: '+49 163-252-0507',
  website: 'alibarangunduz.com',
  email: 'ag@alibarangunduz.com',
};

// Known project links for the exported CV. The tailoring model does not emit
// URLs, so a generated project is matched by name (case-insensitive substring)
// to a canonical URL here. Single-user MVP.
export const projectLinks: { match: string; url: string }[] = [
  { match: 'tailo', url: 'https://github.com/alibarangunduz/tailo' },
];

// Returns the canonical URL for a project name, if one is registered.
export function projectUrl(name: string): string | undefined {
  const lower = name.toLowerCase();
  return projectLinks.find((p) => lower.includes(p.match))?.url;
}
