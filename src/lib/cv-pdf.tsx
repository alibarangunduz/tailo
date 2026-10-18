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
import PDFDocument from '@react-pdf/pdfkit';
import { getDocumentProxy } from 'unpdf';
import { TailorResult, TailoredCVContent } from './types';
import { CVHeader, defaultCvHeader, projectUrl } from './cv-header';

// Colors decoded from the .docx (word/document.xml + theme).
const HEADING_BLUE = '#3C78D8'; // section headings
const RULE_GRAY = '#cfcfcf'; // thin section rule
const MUTED = '#3a3a3a'; // locations, bullet dots

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
    expTitle: { fontFamily: 'Helvetica-Bold', fontSize: u(10), flexShrink: 0 },
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
    // Fallback when the page-centered company would collide with the title or
    // dates: it takes the gap between them, still on the same line, and is cut
    // with an ellipsis if even that is too narrow (the export reports it).
    expCompanyInline: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      marginHorizontal: u(10),
      textAlign: 'center',
      fontFamily: 'Helvetica-Bold',
      fontSize: u(10),
      maxLines: 1,
      textOverflow: 'ellipsis',
    },
    expMeta: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 0 },
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

// Usable line width: US Letter (612pt) minus the left and right page padding.
const CONTENT_WIDTH = 612 - 36 - 32;

// Exact text widths from the same standard-font metrics the renderer uses.
let measurer: PDFDocument | null = null;
function textWidth(text: string, font: string, size: number): number {
  measurer ??= new PDFDocument({ autoFirstPage: false });
  // widthOfString uses the document's current font size, not a size option.
  return measurer.font(font).fontSize(size).widthOfString(text);
}

// Smallest gap around an in-between company, and the smallest header font a
// single row may shrink to (relative to the page scale) before its company is
// cut instead. Small enough not to look different from the other rows.
const MIN_COMPANY_GAP = 4;
const MIN_HEADER_SHRINK = 0.92;
// Measured widths are exact, but leave a hair of room so the renderer's own
// line breaking never decides the text is a fraction too wide.
const FIT_SLACK = 1;

// Where the company goes on its role's single header line, and at what size.
// Mirrors the expTitle/expCompany/expLocation/expDates styles:
// - 'centered': centered on the page, as in the template
// - 'between': centered in the gap between the title and the dates; when the
//   gap is too narrow, the gaps tighten and the row's header text shrinks
//   slightly (never below MIN_HEADER_SHRINK) so the company still fits
// - 'truncated': even then it does not fit, so it is cut with an ellipsis
interface HeaderLayout {
  placement: 'centered' | 'between' | 'truncated';
  // Font size for this row's title, company, location and dates.
  size: number;
  // Horizontal margin on each side of an in-between company.
  gap: number;
  // The company text to print: cut at a word boundary with an ellipsis when
  // truncated (the renderer's own truncation hyphenates mid-word).
  company: string;
}

// Drops whole words from the end until the text plus an ellipsis fits.
function truncateToWidth(text: string, font: string, size: number, room: number): string {
  const words = text.split(' ');
  while (words.length > 1) {
    words.pop();
    const candidate = `${words.join(' ').replace(/[\s,;(]+$/, '')}…`;
    if (textWidth(candidate, font, size) <= room) return candidate;
  }
  return '…';
}

function layoutHeader(
  e: TailoredCVContent['experience'][number],
  scale: number,
): HeaderLayout {
  const size = 10 * scale;
  const gap = 10 * scale;
  if (!e.company) return { placement: 'centered', size, gap, company: e.company };

  // Widths at a 1pt font, so any row size is a simple multiple.
  const unit = (text: string, font: string) => textWidth(text, font, 1);
  const company = unit(e.company, 'Helvetica-Bold');
  const title = unit(e.title, 'Helvetica-Bold');
  const meta =
    (e.location ? unit(e.location, 'Helvetica-Oblique') : 0) +
    (e.dates ? unit(e.dates, 'Helvetica-Bold') : 0);
  // The location's right margin is a fixed style gap, not text.
  const locationGap = e.location ? gap : 0;

  const side = (CONTENT_WIDTH - company * size) / 2;
  if (title * size + gap <= side && meta * size + locationGap + gap <= side) {
    return { placement: 'centered', size, gap, company: e.company };
  }

  const roomAt = (s: number, g: number) =>
    CONTENT_WIDTH - (title + meta) * s - locationGap - 2 * g - FIT_SLACK;
  if (company * size <= roomAt(size, gap)) {
    return { placement: 'between', size, gap, company: e.company };
  }

  // Tighten the gaps, then shrink this row's text just enough to fit.
  const minGap = MIN_COMPANY_GAP * scale;
  const fitSize =
    (CONTENT_WIDTH - locationGap - 2 * minGap - FIT_SLACK) /
    (company + title + meta);
  if (fitSize >= size * MIN_HEADER_SHRINK) {
    return {
      placement: 'between',
      size: Math.min(size, fitSize),
      gap: minGap,
      company: e.company,
    };
  }
  const minSize = size * MIN_HEADER_SHRINK;
  return {
    placement: 'truncated',
    size: minSize,
    gap: minGap,
    company: truncateToWidth(e.company, 'Helvetica-Bold', minSize, roomAt(minSize, minGap)),
  };
}

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

function CVDocument({
  result,
  scale,
  header,
}: {
  result: TailorResult;
  scale: number;
  header: CVHeader;
}) {
  const cv = sanitizeCv(result.tailoredCV);
  const styles = makeStyles(scale);

  return (
    <Document title={`${header.name} - CV`} author={header.name}>
      <Page size="LETTER" style={styles.page}>
        {/* Header: name + contacts on one line. Each contact renders only if set. */}
        <Text style={styles.headerLine}>
          <Text style={styles.name}>{toLatin1(header.name)}</Text>
          {header.linkedin ? (
            <>
              <Text style={styles.sep}>{'  |  '}</Text>
              <Link style={styles.link} src={`https://${header.linkedin}`}>
                {header.linkedin}
              </Link>
            </>
          ) : null}
          {header.phone ? (
            <>
              <Text style={styles.sep}>{'  |  '}</Text>
              <Text style={styles.plain}>{header.phone}</Text>
            </>
          ) : null}
          {header.website ? (
            <>
              <Text style={styles.sep}>{'  |  '}</Text>
              <Link style={styles.link} src={`https://${header.website}`}>
                {header.website}
              </Link>
            </>
          ) : null}
          {header.email ? (
            <>
              <Text style={styles.sep}>{'  |  '}</Text>
              <Link style={styles.link} src={`mailto:${header.email}`}>
                {header.email}
              </Link>
            </>
          ) : null}
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
            {cv.experience.map((e, i) => {
              const header = layoutHeader(e, scale);
              const size = { fontSize: header.size };
              return (
                <View key={i} wrap={false}>
                  <View style={styles.expRow}>
                    <Text style={[styles.expTitle, size]}>{e.title}</Text>
                    {e.company ? (
                      <Text
                        style={
                          header.placement === 'centered'
                            ? [styles.expCompany, size]
                            : [styles.expCompanyInline, size, { marginHorizontal: header.gap }]
                        }
                      >
                        {header.company}
                      </Text>
                    ) : null}
                    <View style={styles.expMeta}>
                      {e.location ? (
                        <Text style={[styles.expLocation, size]}>{e.location}</Text>
                      ) : null}
                      {e.dates ? <Text style={[styles.expDates, size]}>{e.dates}</Text> : null}
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
              );
            })}
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
            {/* One entry per line (degree first, then exchange, etc.), each at
                the normal paragraph size. Entries are " | "-separated by the
                model; the one-page auto-fit keeps the whole CV on one page. */}
            {cv.education
              .split(' | ')
              .map((entry) => entry.trim())
              .filter(Boolean)
              .map((entry, i) => (
                <Text key={i} style={styles.paragraph}>
                  {entry}
                </Text>
              ))}
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

function renderAt(result: TailorResult, scale: number, header: CVHeader): Promise<Blob> {
  return pdf(<CVDocument result={result} scale={scale} header={header} />).toBlob();
}

export interface CvPdfFit {
  blob: Blob;
  // Content scale the CV rendered at (MIN_SCALE to MAX_SCALE).
  scale: number;
  pages: number;
  // Roles whose company did not fit on the header line and was cut with an
  // ellipsis, as "Title, Company", so the UI can ask the user to shorten them.
  truncatedHeaders: string[];
}

function truncatedHeaders(result: TailorResult, scale: number): string[] {
  return sanitizeCv(result.tailoredCV)
    .experience.filter((e) => layoutHeader(e, scale).placement === 'truncated')
    .map((e) => `${e.title}, ${e.company}`);
}

// Renders the CV at the largest content scale that still fits on one page.
// Taller content produces more pages, so page count is monotonic in scale and a
// binary search converges in a handful of fast renders. Also reports the scale
// and page count, which the eval (evals/tailor) grades.
export async function fitCvPdf(
  result: TailorResult,
  header: CVHeader = defaultCvHeader,
): Promise<CvPdfFit> {
  // If the largest scale already fits, the CV is short: use it to fill the page.
  const maxBlob = await renderAt(result, MAX_SCALE, header);
  if ((await countPages(maxBlob)) === 1) {
    return {
      blob: maxBlob,
      scale: MAX_SCALE,
      pages: 1,
      truncatedHeaders: truncatedHeaders(result, MAX_SCALE),
    };
  }

  // If even the smallest scale overflows, the content is too long to fit on one
  // page: return the most compact render as a best effort.
  let fitBlob = await renderAt(result, MIN_SCALE, header);
  const minPages = await countPages(fitBlob);
  if (minPages > 1) {
    return {
      blob: fitBlob,
      scale: MIN_SCALE,
      pages: minPages,
      truncatedHeaders: truncatedHeaders(result, MIN_SCALE),
    };
  }

  // Binary search for the largest one-page scale between the bounds.
  let lo = MIN_SCALE;
  let hi = MAX_SCALE;
  for (let i = 0; i < FIT_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const blob = await renderAt(result, mid, header);
    if ((await countPages(blob)) === 1) {
      lo = mid;
      fitBlob = blob;
    } else {
      hi = mid;
    }
  }

  return {
    blob: fitBlob,
    scale: lo,
    pages: 1,
    truncatedHeaders: truncatedHeaders(result, lo),
  };
}

export async function generateCvPdf(
  result: TailorResult,
  header: CVHeader = defaultCvHeader,
): Promise<Blob> {
  return (await fitCvPdf(result, header)).blob;
}
