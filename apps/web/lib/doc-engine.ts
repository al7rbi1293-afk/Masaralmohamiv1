/**
 * Document generation engine.
 * Builds DOCX and PDF documents from preset variable schemas.
 * No copyrighted legal paragraphs — assembles user-provided values only.
 */
import 'server-only';

import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    HeadingLevel,
    BorderStyle,
} from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type DocParams = {
    orgName: string;
    title: string;
    presetNameAr: string;
    date: string;
    /** Variable label → value pairs */
    fields: Array<{ label: string; value: string }>;
};

/* ------------------------------------------------------------------ */
/*  DOCX Builder                                                      */
/* ------------------------------------------------------------------ */

export async function buildDocx(params: DocParams): Promise<Buffer> {
    const { orgName, title, presetNameAr, date, fields } = params;

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: 'Arial', size: 24 },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1000,
                            right: 1000,
                            bottom: 1000,
                            left: 1000,
                        },
                    },
                },
                children: [
                    // Header: Org name
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: orgName, bold: true, size: 32 }),
                        ],
                    }),
                    // Subtitle: preset type
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200 },
                        children: [
                            new TextRun({ text: presetNameAr, size: 28, color: '666666' }),
                        ],
                    }),
                    // Separator
                    new Paragraph({
                        spacing: { before: 200, after: 200 },
                        border: {
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                        },
                        children: [],
                    }),
                    // Title
                    new Paragraph({
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: title, bold: true, size: 28 })],
                    }),
                    // Date
                    new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        spacing: { after: 300 },
                        children: [
                            new TextRun({ text: `التاريخ: ${date}`, size: 22, color: '999999' }),
                        ],
                    }),
                    // Fields
                    ...fields.flatMap((field) => [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            spacing: { before: 200 },
                            children: [
                                new TextRun({ text: `${field.label}:`, bold: true, size: 24 }),
                            ],
                        }),
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            spacing: { after: 100 },
                            children: [
                                new TextRun({ text: field.value || '—', size: 24 }),
                            ],
                        }),
                    ]),
                ],
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
}

/* ------------------------------------------------------------------ */
/*  PDF Builder                                                       */
/* ------------------------------------------------------------------ */

export async function buildPdf(params: DocParams): Promise<Buffer> {
    const { orgName, title, presetNameAr, date, fields } = params;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595; // A4
    const pageHeight = 842;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const drawText = (
        text: string,
        options: {
            fontSize?: number;
            bold?: boolean;
            color?: [number, number, number];
            align?: 'left' | 'center' | 'right';
            lineSpacing?: number;
        } = {},
    ) => {
        const {
            fontSize = 12,
            bold = false,
            color = [0, 0, 0],
            align = 'left',
            lineSpacing = 1.5,
        } = options;
        const f = bold ? fontBold : font;

        // Simple word wrapping
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const width = f.widthOfTextAtSize(testLine, fontSize);
            if (width > contentWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        for (const line of lines) {
            if (y < margin + fontSize) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                y = pageHeight - margin;
            }

            let x = margin;
            if (align === 'center') {
                const w = f.widthOfTextAtSize(line, fontSize);
                x = (pageWidth - w) / 2;
            } else if (align === 'right') {
                const w = f.widthOfTextAtSize(line, fontSize);
                x = pageWidth - margin - w;
            }

            page.drawText(line, {
                x,
                y,
                size: fontSize,
                font: f,
                color: rgb(color[0], color[1], color[2]),
            });

            y -= fontSize * lineSpacing;
        }
    };

    // Header
    drawText(orgName, { fontSize: 18, bold: true, align: 'center' });
    drawText(presetNameAr, { fontSize: 14, color: [0.4, 0.4, 0.4], align: 'center' });
    y -= 10;

    // Line separator
    page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
    });
    y -= 20;

    // Title + date
    drawText(title, { fontSize: 16, bold: true });
    drawText(`Date: ${date}`, { fontSize: 10, color: [0.6, 0.6, 0.6] });
    y -= 10;

    // Fields
    for (const field of fields) {
        drawText(`${field.label}:`, { fontSize: 12, bold: true });
        drawText(field.value || '—', { fontSize: 12 });
        y -= 5;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}
