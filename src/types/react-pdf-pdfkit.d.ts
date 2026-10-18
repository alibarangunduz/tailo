// Minimal types for @react-pdf/pdfkit, which ships none. cv-pdf.tsx only uses
// it to measure text with the same standard-font metrics the renderer uses.
declare module '@react-pdf/pdfkit' {
  export default class PDFDocument {
    constructor(options?: { autoFirstPage?: boolean });
    font(name: string): this;
    fontSize(size: number): this;
    widthOfString(text: string): number;
  }
}
