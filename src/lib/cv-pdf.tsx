// One-page, ATS-friendly PDF export of a tailored CV.
// Reproduces the layout of the master CV template (CV Template Tailo.docx):
// single-line header, blue section headings with thin rules, centered company
// in experience rows, italic locations.
// Content is auto-fit: the export renders at the largest scale that still fits
// on a single page, so short CVs fill the page and long ones never spill over.
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
import { getDocumentProxy } from 'unpdf';
import { TailorResult, TailoredCVContent } from './types';
import { cvHeader, projectUrl } from './cv-header';

// Colors decoded from the .docx (word/document.xml + theme).
const HEADING_BLUE = '#3C78D8'; // section headings
const RULE_GRAY = '#cfcfcf'; // thin section rule
const MUTED = '#3a3a3a'; // locations, bullet dots

// US Letter content width (pt): page width minus the fixed left/right padding.
const CONTENT_WIDTH = 612 - 36 - 32;

// Largest font size in [min, max] at which `text` fits on one line of
// CONTENT_WIDTH. Helvetica's average glyph advance is roughly 0.55em across
// mixed prose, close enough to keep a one-line field from wrapping.
function fitOneLineSize(text: string, max: number, min: number): number {
  if (!text) return max;
  if (text.length * max * 0.55 <= CONTENT_WIDTH) return max;
  return Math.max(min, CONTENT_WIDTH / (text.length * 0.55));
}

// Built-in Helvetica/Times-Roman only cover Latin-1. Turkish letters outside
// that range render as a fallback box, so transliterate them to their ASCII
// base. Temporary until real Unicode fonts are registered (see AGENTS.md).
const LATIN1_FALLBACK: Record<string, string> = {
  İ: 'I',
  ı: 'i',
  Ğ: 'G',
  ğ: 'g',
  Ş: 'S',
  ş: 's',
};

function toLatin1(text: string): string {
  return text.replace(/[İıĞğŞş]/g, (ch) => LATIN1_FALLBACK[ch] ?? ch);
}

// Applies the Latin-1 fallback to every text field of the tailored CV.
function sanitizeCv(cv: TailoredCVContent): TailoredCVContent {
  return {
    summary: toLatin1(cv.summary),
    skills: cv.skills.map((s) => ({
      category: toLatin1(s.category),
      items: toLatin1(s.items),
    })),
    experience: cv.experience.map((e) => ({
      title: toLatin1(e.title),
      company: toLatin1(e.company),
      location: toLatin1(e.location),
      dates: toLatin1(e.dates),
      subsections: e.subsections.map((sub) => ({
        heading: toLatin1(sub.heading),
        bullets: sub.bullets.map(toLatin1),
      })),
    })),
    education: toLatin1(cv.education),
    projects: cv.projects.map((p) => ({
      name: toLatin1(p.name),
      technologies: toLatin1(p.technologies),
      description: toLatin1(p.description),
    })),
  };
}

// Page geometry: US Letter. 1 inch = 72pt. Page margins are fixed (a deliberate
// design choice); only the content sizes below scale to auto-fit one page.
function makeStyles(scale: number) {
  // Scales a content dimension (font size, gap, indent) by the fit factor.
  const u = (n: number) => n * scale;

  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: u(9),
      color: '#000000',
      paddingTop: 28,
      paddingRight: 32,
      paddingBottom: 20,
      paddingLeft: 36,
      lineHeight: 1.4,
    },

    // Header: name + contacts on a single centered line. Fixed sizes (not
    // scaled by u()): the header is identical on every CV, so it stays out of
    // the body auto-fit and can never grow wide enough to wrap.
    headerLine: { textAlign: 'center', marginBottom: 4 },
    name: { fontFamily: 'Times-Roman', fontSize: 15 },
    sep: { fontSize: 8, color: MUTED },
    // Header contacts: clickable but styled as plain black text. textDecoration
    // must be set explicitly: react-pdf Links default to an underline.
    link: { fontSize: 8, color: '#000000', textDecoration: 'none' },
    plain: { fontSize: 8, color: '#000000' },

    // Section heading: blue word + thin gray rule filling the rest of the line.
    headingRow: { flexDirection: 'row', alignItems: 'center', marginTop: u(11), marginBottom: u(4) },
    headingText: { fontFamily: 'Helvetica-Bold', fontSize: u(12), color: HEADING_BLUE },
    headingRule: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor: RULE_GRAY,
      marginLeft: u(6),
      marginBottom: 2,
    },

    summary: { fontSize: u(9), lineHeight: 1.4 },

    skillLine: { fontSize: u(8.5), lineHeight: 1.4, marginBottom: u(1.5) },
    skillCategory: { fontFamily: 'Helvetica-Bold' },

    // Experience: Title left, Company centered on the page, Location italic, Dates right.
    expRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginTop: u(7),
      position: 'relative',
    },
    expTitle: { fontFamily: 'Helvetica-Bold', fontSize: u(10) },
    // Absolutely positioned across the full content width so it centers on the
    // page, independent of the title and date widths on either side.
    expCompany: {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: 'Helvetica-Bold',
      fontSize: u(10),
    },
    expMeta: { flexDirection: 'row', alignItems: 'baseline' },
    expLocation: { fontFamily: 'Helvetica-Oblique', fontSize: u(10), color: MUTED, marginRight: u(10) },
    expDates: { fontFamily: 'Helvetica-Bold', fontSize: u(10) },

    subHeading: { fontFamily: 'Helvetica-Bold', fontSize: u(9.5), marginTop: u(4), marginBottom: u(1) },

    // Bullet list with hanging indent.
    bulletRow: { flexDirection: 'row', marginBottom: u(1.5) },
    bulletDot: { width: u(11), fontSize: u(8.5), color: MUTED },
    bulletText: { flex: 1, fontSize: u(8.5), lineHeight: 1.35 },

    paragraph: { fontSize: u(9), lineHeight: 1.4, marginBottom: u(2) },

    // Projects: name + technologies on one line, description below.
    project: { fontSize: u(8.5), lineHeight: 1.4, marginBottom: u(3) },
    // Bold black, no underline: applies whether the project name renders as
    // plain text or as a clickable Link.
    projectName: { fontFamily: 'Helvetica-Bold', color: '#000000', textDecoration: 'none' },
    projectTech: { fontFamily: 'Helvetica-Oblique', color: MUTED },
  });
}

type Styles = ReturnType<typeof makeStyles>;

function SectionHeading({ children, styles }: { children: string; styles: Styles }) {
  return (
    <View style={styles.headingRow}>
      <Text style={styles.headingText}>{children}</Text>
      <View style={styles.headingRule} />
    </View>
  );
}

function Bullet({ children, styles }: { children: string; styles: Styles }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function CVDocument({ result, scale }: { result: TailorResult; scale: number }) {
  const cv = sanitizeCv(result.tailoredCV);
  const styles = makeStyles(scale);

  return (
    <Document title={`${cvHeader.name} - CV`} author={cvHeader.name}>
      <Page size="LETTER" style={styles.page}>
        {/* Header: name + contacts on one line */}
        <Text style={styles.headerLine}>
          <Text style={styles.name}>{toLatin1(cvHeader.name)}</Text>
          <Text style={styles.sep}>{'  |  '}</Text>
          <Link style={styles.link} src={`https://${cvHeader.linkedin}`}>
            {cvHeader.linkedin}
          </Link>
          <Text style={styles.sep}>{'  |  '}</Text>
          <Text style={styles.plain}>{cvHeader.phone}</Text>
          <Text style={styles.sep}>{'  |  '}</Text>
          <Link style={styles.link} src={`https://${cvHeader.website}`}>
            {cvHeader.website}
          </Link>
          <Text style={styles.sep}>{'  |  '}</Text>
          <Link style={styles.link} src={`mailto:${cvHeader.email}`}>
            {cvHeader.email}
          </Link>
        </Text>

        {cv.summary ? (
          <View>
            <SectionHeading styles={styles}>Summary</SectionHeading>
            <Text style={styles.summary}>{cv.summary}</Text>
          </View>
        ) : null}

        {cv.skills.length > 0 ? (
          <View>
            <SectionHeading styles={styles}>Skills</SectionHeading>
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
            <SectionHeading styles={styles}>Experience</SectionHeading>
            {cv.experience.map((e, i) => (
              <View key={i} wrap={false}>
                <View style={styles.expRow}>
                  <Text style={styles.expTitle}>{e.title}</Text>
                  <Text style={styles.expCompany}>{e.company}</Text>
                  <View style={styles.expMeta}>
                    {e.location ? (
                      <Text style={styles.expLocation}>{e.location}</Text>
                    ) : null}
                    {e.dates ? <Text style={styles.expDates}>{e.dates}</Text> : null}
                  </View>
                </View>
                {e.subsections.map((sub, j) => (
                  <View key={j}>
                    {sub.heading ? (
                      <Text style={styles.subHeading}>{sub.heading}</Text>
                    ) : null}
                    {sub.bullets.map((b, k) => (
                      <Bullet key={k} styles={styles}>{b}</Bullet>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {cv.projects.length > 0 ? (
          <View>
            <SectionHeading styles={styles}>Projects</SectionHeading>
            {cv.projects.map((p, i) => {
              const url = projectUrl(p.name);
              return (
                <Text key={i} style={styles.project}>
                  {url ? (
                    <Link style={styles.projectName} src={url}>
                      {p.name}
                    </Link>
                  ) : (
                    <Text style={styles.projectName}>{p.name}</Text>
                  )}
                  {p.technologies ? (
                    <Text style={styles.projectTech}>{` (${p.technologies})`}</Text>
                  ) : null}
                  {p.description ? <Text>{` — ${p.description}`}</Text> : null}
                </Text>
              );
            })}
          </View>
        ) : null}

        {cv.education ? (
          <View>
            <SectionHeading styles={styles}>Education</SectionHeading>
            {/* Education is a single line: shrink the font if needed so it
                never wraps to a second line. */}
            <Text
              style={[
                styles.paragraph,
                { fontSize: fitOneLineSize(cv.education, 9 * scale, 6.5) },
              ]}
            >
              {cv.education}
            </Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

// Auto-fit bounds. The export searches for the largest scale in this range that
// still renders on a single page: MIN crams a long CV down, MAX lets a short CV
// grow to fill the page without looking oversized.
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.18;
// Binary-search steps between the bounds. Each step is one extra render.
const FIT_STEPS = 6;

async function countPages(blob: Blob): Promise<number> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const doc = await getDocumentProxy(bytes);
  return doc.numPages;
}

function renderAt(result: TailorResult, scale: number): Promise<Blob> {
  return pdf(<CVDocument result={result} scale={scale} />).toBlob();
}

// Renders the CV at the largest content scale that still fits on one page.
// Taller content produces more pages, so page count is monotonic in scale and a
// binary search converges in a handful of fast renders.
export async function generateCvPdf(result: TailorResult): Promise<Blob> {
  // If the largest scale already fits, the CV is short: use it to fill the page.
  const maxBlob = await renderAt(result, MAX_SCALE);
  if ((await countPages(maxBlob)) === 1) return maxBlob;

  // If even the smallest scale overflows, the content is too long to fit on one
  // page: return the most compact render as a best effort.
  let fitBlob = await renderAt(result, MIN_SCALE);
  if ((await countPages(fitBlob)) > 1) return fitBlob;

  // Binary search for the largest one-page scale between the bounds.
  let lo = MIN_SCALE;
  let hi = MAX_SCALE;
  for (let i = 0; i < FIT_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const blob = await renderAt(result, mid);
    if ((await countPages(blob)) === 1) {
      lo = mid;
      fitBlob = blob;
    } else {
      hi = mid;
    }
  }

  return fitBlob;
}
