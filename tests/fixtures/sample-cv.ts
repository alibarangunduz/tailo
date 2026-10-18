// Synthetic test data for a fictional candidate. Never put real CV data here:
// this file is committed. The real eval fixtures stay git-ignored under
// evals/tailor/fixtures.
import type { TailorResult } from '@/lib/types';

export const MASTER_CV = `Jordan Example
Berlin, Germany | jordan@example.com

SUMMARY
Backend engineer with six years of experience building payment and data platforms in TypeScript and Go.

EXPERIENCE
Senior Software Engineer, Northwind Payments GmbH, Berlin, March 2022 – Present
- Led the migration of the settlement service to event sourcing on Kafka, cutting reconciliation time by 40%.
- Built a TypeScript SDK used by 30 merchant integrations.
- Mentored four engineers and ran the backend guild.

Software Engineer, Contoso Analytics, Munich, July 2019 – February 2022
- Designed ingestion pipelines in Go processing 2 billion events per day.
- Introduced PostgreSQL partitioning that halved query latency for reporting.

SKILLS
TypeScript, Go, Node.js, PostgreSQL, Kafka, Docker, Kubernetes, AWS, Terraform, gRPC

EDUCATION
B.Sc. Computer Science, Technical University of Exampleton, 2015 – 2019

CERTIFICATIONS
AWS Certified Solutions Architect

PROJECTS
Ledgerlite: open source double-entry ledger library in TypeScript.
`;

export const JOB = {
  company: 'Fabrikam Bank',
  jobTitle: 'Senior Backend Engineer',
  jobDescription:
    'We are looking for a Senior Backend Engineer to build our payments core in TypeScript and Kafka. Experience with PostgreSQL, AWS and mentoring is a plus.',
};

// A well-formed tailored result that fits one page and passes every eval check.
export function sampleResult(): TailorResult {
  return {
    matchScore: 82,
    scoreBreakdown: {
      technicalSkillsMatch: 85,
      experienceRelevance: 88,
      seniorityFit: 80,
      culturalSignals: 70,
    },
    gaps: [
      {
        requirement: 'Banking domain',
        status: 'partial',
        suggestion: 'Mention settlement and reconciliation work.',
      },
    ],
    strengths: [
      {
        requirement: 'Kafka',
        candidateEvidence: 'Migrated the settlement service to event sourcing on Kafka.',
      },
    ],
    tailoredCV: {
      summary:
        'Senior backend engineer with six years building payment and data platforms in TypeScript and Go, with hands-on Kafka and PostgreSQL experience.',
      skills: [
        { category: 'Languages', items: 'TypeScript, Go' },
        { category: 'Data', items: 'PostgreSQL, Kafka' },
        { category: 'Cloud', items: 'AWS, Docker, Kubernetes, Terraform' },
      ],
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'Northwind Payments GmbH',
          location: 'Berlin',
          dates: 'March 2022 – Present',
          subsections: [
            {
              heading: '',
              bullets: [
                'Led the migration of the settlement service to event sourcing on Kafka, cutting reconciliation time by 40%.',
                'Built a TypeScript SDK used by 30 merchant integrations.',
                'Mentored four engineers and ran the backend guild.',
              ],
            },
          ],
        },
        {
          title: 'Software Engineer',
          company: 'Contoso Analytics',
          location: 'Munich',
          dates: 'July 2019 – February 2022',
          subsections: [
            {
              heading: '',
              bullets: [
                'Designed ingestion pipelines in Go processing 2 billion events per day.',
                'Introduced PostgreSQL partitioning that halved query latency for reporting.',
              ],
            },
          ],
        },
      ],
      education:
        'B.Sc. Computer Science, Technical University of Exampleton, 2015 – 2019 | Certifications: AWS Certified Solutions Architect',
      projects: [
        {
          name: 'Ledgerlite',
          technologies: 'TypeScript',
          description: 'Open source double-entry ledger library.',
        },
      ],
    },
    strategyNotes: 'Lead with payments and Kafka.',
  };
}
