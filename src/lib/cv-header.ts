// Contact header for the exported CV PDF. Single-user MVP: these values come
// from the master CV template (CV Template Tailo.docx) and can be edited here.

export interface CVHeader {
  name: string;
  linkedin: string;
  phone: string;
  website: string;
  email: string;
}

export const cvHeader: CVHeader = {
  name: 'Ali Baran Gündüz',
  linkedin: 'linkedin.com/in/alibarangunduz',
  phone: '+49 163-252-0507',
  website: 'alibarangunduz.com',
  email: 'ag@alibarangunduz.com',
};
