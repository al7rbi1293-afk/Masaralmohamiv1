import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAdmin } from '@/lib/admin';
import {
  buildLawyerSurveyExportRows,
  getLawyerSurveyResponses,
  LAWYER_SURVEY_EXPORT_COLUMNS,
} from '@/lib/admin-lawyer-surveys';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ message: 'غير مصرح.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format')?.trim().toLowerCase() ?? 'csv';

  if (format !== 'csv' && format !== 'xlsx') {
    return NextResponse.json({ message: 'صيغة التصدير غير صالحة.' }, { status: 400 });
  }

  const responses = await getLawyerSurveyResponses();
  const rows = buildLawyerSurveyExportRows(responses);

  if (format === 'csv') {
    const headers = LAWYER_SURVEY_EXPORT_COLUMNS.map((column) => column.label);
    const csvLines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => escapeCsv(sanitizeCsvCell(row[header] ?? ''))).join(','),
      ),
    ];

    return new NextResponse(`\uFEFF${csvLines.join('\n')}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="lawyer-survey-responses.csv"',
      },
    });
  }

  const headers = LAWYER_SURVEY_EXPORT_COLUMNS.map((column) => column.label);
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? '')),
  ]);

  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.min(
      42,
      Math.max(
        14,
        header.length + 2,
        ...rows.map((row) => String(row[header] ?? '').slice(0, 80).length + 2),
      ),
    ),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lawyer Survey');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="lawyer-survey-responses.xlsx"',
    },
  });
}

function escapeCsv(value: string) {
  if (!value) {
    return '';
  }

  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function sanitizeCsvCell(value: string) {
  const normalized = String(value ?? '');
  if (!normalized) {
    return '';
  }

  const firstCharacter = normalized[0];
  if (firstCharacter === '=' || firstCharacter === '+' || firstCharacter === '-' || firstCharacter === '@') {
    return `'${normalized}`;
  }

  return normalized;
}
