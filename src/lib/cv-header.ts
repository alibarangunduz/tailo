// Contact header for the exported CV PDF. The live values are stored per user in
// the Settings table and edited from the settings page. A new user's row is
// seeded from their account name and email; every other field starts empty.

export interface CVHeader {
  name: string;
  linkedin: string;
  phone: string;
  website: string;
  email: string;
}

export const emptyCvHeader: CVHeader = {
  name: '',
  linkedin: '',
  phone: '',
  website: '',
  email: '',
};
