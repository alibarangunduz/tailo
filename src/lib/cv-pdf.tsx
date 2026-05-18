// One-page, ATS-friendly PDF export of a tailored CV.
// Reproduces the layout of the master CV template (CV Template Tailo.docx):
// single-line header, blue section headings with thin rules, centered company
// in experience rows, italic locations.
// Dynamically imported on the client only, so @react-pdf/renderer never reaches
// the SSR or initial bundle.

import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { TailorResult } from './types';
import { cvHeader } from './cv-header';

// Colors decoded from the .docx (word/document.xml + theme).
const HEADING_BLUE = '#3C78D8'; // section headings
const LINK_BLUE = '#1155CC'; // hyperlinks
const RULE_GRAY = '#cfcfcf'; // thin section rule
const MUTED = '#3a3a3a'; // locations, bullet dots

// Page geometry: US Letter. 1 inch = 72pt.
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
    paddingTop: 28,
    paddingRight: 32,
    paddingBottom: 20,
    paddingLeft: 36,
    lineHeight: 1.4,
  },

  // Header: name + contacts on a single centered line.
  headerLine: { textAlign: 'center', marginBottom: 4 },
  name: { fontFamily: 'Times-Roman', fontSize: 15 },
  sep: { fontSize: 8.5, color: MUTED },
  link: { fontSize: 8.5, color: LINK_BLUE, textDecoration: 'underline' },
  plain: { fontSize: 8.5, color: '#000000' },

  // Section heading: blue word + thin gray rule filling the rest of the line.
  headingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 11, marginBottom: 4 },
  headingText: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: HEADING_BLUE },
  headingRule: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: RULE_GRAY,
    marginLeft: 6,
    marginBottom: 2,
  },

  summary: { fontSize: 9, lineHeight: 1.4 },

  skillLine: { fontSize: 8.5, lineHeight: 1.4, marginBottom: 1.5 },
  skillCategory: { fontFamily: 'Helvetica-Bold' },

  // Experience: Title left, Company centered + underlined, Location italic, Dates right.
  expRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 7 },
  expTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  expCompany: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textDecoration: 'underline',
    marginHorizontal: 8,
  },
  expLocation: { fontFamily: 'Helvetica-Oblique', fontSize: 10, color: MUTED, marginRight: 10 },
  expDates: { fontFamily: 'Helvetica-Bold', fontSize: 10 },

  subHeading: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginTop: 4, marginBottom: 1 },

  // Bullet list with hanging indent.
  bulletRow: { flexDirection: 'row', marginBottom: 1.5 },
  bulletDot: { width: 11, fontSize: 8.5, color: MUTED },
  bulletText: { flex: 1, fontSize: 8.5, lineHeight: 1.35 },

  paragraph: { fontSize: 9, lineHeight: 1.4, marginBottom: 2 },

  // Projects: name + technologies on one line, description below.
  project: { fontSize: 8.5, lineHeight: 1.4, marginBottom: 3 },
  projectName: { fontFamily: 'Helvetica-Bold' },
  projectTech: { fontFamily: 'Helvetica-Oblique', color: MUTED },
});

function SectionHeading({ children }: { children: string }) {
  return (
    <View style={styles.headingRow}>
      <Text style={styles.headingText}>{children}</Text>
      <View style={styles.headingRule} />
    </View>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function CVDocument({ result }: { result: TailorResult }) {
  const cv = result.tailoredCV;

  return (
    <Document title={`${cvHeader.name} - CV`} author={cvHeader.name}>
      <Page size="LETTER" style={styles.page}>
        {/* Header: name + contacts on one line */}
        <Text style={styles.headerLine}>
          <Text style={styles.name}>{cvHeader.name}</Text>
          <Text style={styles.sep}>{'   |   '}</Text>
          <Link style={styles.link} src={`https://${cvHeader.linkedin}`}>
            {cvHeader.linkedin}
          </Link>
          <Text style={styles.sep}>{'   |   '}</Text>
          <Text style={styles.plain}>{cvHeader.phone}</Text>
          <Text style={styles.sep}>{'   |   '}</Text>
          <Link style={styles.link} src={`https://${cvHeader.website}`}>
            {cvHeader.website}
          </Link>
          <Text style={styles.sep}>{'   |   '}</Text>
          <Link style={styles.link} src={`mailto:${cvHeader.email}`}>
            {cvHeader.email}
          </Link>
        </Text>

        {cv.summary ? (
          <View>
            <SectionHeading>Summary</SectionHeading>
            <Text style={styles.summary}>{cv.summary}</Text>
          </View>
        ) : null}

        {cv.skills.length > 0 ? (
          <View>
            <SectionHeading>Skills</SectionHeading>
            {cv.skills.map((s, i) => (
              <Text key={i} style={styles.skillLine}>
                <Text>• </Text>
                <Text style={styles.skillCategory}>{s.category}: </Text>
                <Text>{s.items}</Text>
              </Text>
            ))}
          </View>
        ) : null}

        {cv.experience.length > 0 ? (
          <View>
            <SectionHeading>Experience</SectionHeading>
            {cv.experience.map((e, i) => (
              <View key={i} wrap={false}>
                <View style={styles.expRow}>
                  <Text style={styles.expTitle}>{e.title}</Text>
                  <Text style={styles.expCompany}>{e.company}</Text>
                  {e.location ? (
                    <Text style={styles.expLocation}>{e.location}</Text>
                  ) : null}
                  {e.dates ? <Text style={styles.expDates}>{e.dates}</Text> : null}
                </View>
                {e.subsections.map((sub, j) => (
                  <View key={j}>
                    {sub.heading ? (
                      <Text style={styles.subHeading}>{sub.heading}</Text>
                    ) : null}
                    {sub.bullets.map((b, k) => (
                      <Bullet key={k}>{b}</Bullet>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {cv.projects.length > 0 ? (
          <View>
            <SectionHeading>Projects</SectionHeading>
            {cv.projects.map((p, i) => (
              <Text key={i} style={styles.project}>
                <Text style={styles.projectName}>{p.name}</Text>
                {p.technologies ? (
                  <Text style={styles.projectTech}>{` (${p.technologies})`}</Text>
                ) : null}
                {p.description ? <Text>{` — ${p.description}`}</Text> : null}
              </Text>
            ))}
          </View>
        ) : null}

        {cv.education ? (
          <View>
            <SectionHeading>Education</SectionHeading>
            <Text style={styles.paragraph}>{cv.education}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function generateCvPdf(result: TailorResult): Promise<Blob> {
  return pdf(<CVDocument result={result} />).toBlob();
}
