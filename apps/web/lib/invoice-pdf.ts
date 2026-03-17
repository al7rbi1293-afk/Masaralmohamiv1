import 'server-only';

import React from 'react';
import { CircuitOpenError, TimeoutError, withCircuitBreaker, withTimeout } from '@/lib/runtime-safety';

let fontsRegistered = false;

export type InvoicePdfItem = {
  desc: string;
  qty: number;
  unit_price: number;
};

export type InvoicePdfPayload = {
  number: string;
  items: unknown;
  subtotal: string | number;
  tax: string | number;
  total: string | number;
  currency: string;
  status: string;
  issued_at: string;
  due_at: string | null;
  clientName?: string | null;
  clientAddress?: string | null;
  orgName?: string | null;
  orgAddress?: string | null;
  logoUrl?: string | null;
  paidAmount: number;
  remaining: number;
  taxNumber?: string | null;
  crNumber?: string | null;
  qrCode?: string | null;
};

export async function renderInvoicePdfBuffer(payload: InvoicePdfPayload) {
  const { Document, Font, Image, Page, StyleSheet, Text, View, pdf } = await import('@react-pdf/renderer');

  if (!fontsRegistered) {
    try {
      Font.register({
        family: 'IBM Plex Sans Arabic',
        fonts: [
          {
            src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansarabic/IBMPlexSansArabic-Regular.ttf',
            fontWeight: 400,
          },
          {
            src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansarabic/IBMPlexSansArabic-Bold.ttf',
            fontWeight: 700,
          },
        ],
      });
      fontsRegistered = true;
    } catch {
      fontsRegistered = true;
    }
  }

  const styles = StyleSheet.create({
    page: {
      padding: 32,
      fontSize: 12,
      fontFamily: 'IBM Plex Sans Arabic',
      color: '#111827',
      direction: 'rtl',
    },
    header: {
      marginBottom: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerText: {},
    logo: {
      width: 64,
      height: 64,
      objectFit: 'contain' as any,
      borderRadius: 6,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 30,
    },
    infoBlock: {
      width: '45%',
    },
    infoTitle: {
      fontSize: 10,
      color: '#64748B',
      marginBottom: 4,
      fontFamily: 'IBM Plex Sans Arabic', // Changed from Outfit to match existing font
    },
    infoText: {
      fontSize: 11,
      color: '#1E293B',
      fontFamily: 'IBM Plex Sans Arabic', // Changed from Outfit to match existing font
      lineHeight: 1.4,
    },
    title: {
      fontSize: 18,
      fontWeight: 700,
    },
    subtitle: {
      fontSize: 12,
      marginTop: 4,
      color: '#334155',
    },
    section: {
      marginTop: 12,
      padding: 12,
      border: '1px solid #E5E7EB',
      borderRadius: 8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 6,
    },
    label: {
      color: '#64748B',
    },
    value: {
      fontWeight: 700,
    },
    tableHeader: {
      flexDirection: 'row',
      borderBottom: '1px solid #E5E7EB',
      paddingBottom: 6,
      marginBottom: 6,
      fontWeight: 700,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottom: '1px solid #F1F5F9',
      paddingVertical: 6,
    },
    cellDesc: { width: '46%' },
    cellQty: { width: '12%', textAlign: 'right' },
    cellUnit: { width: '20%', textAlign: 'right' },
    cellTotal: { width: '22%', textAlign: 'right' },
    totals: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: '1px solid #E5E7EB',
    },
    note: {
      marginTop: 14,
      fontSize: 10,
      color: '#64748B',
    },
    qrCode: {
      marginTop: 20,
      width: 80,
      height: 80,
      alignSelf: 'flex-start',
    },
  });

  const items = normalizeItems(payload.items);
  const safeNumber = String(payload.number ?? '').trim() || 'invoice';

  const PdfDocument = React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerText },
          React.createElement(Text, { style: styles.title }, payload.orgName ?? 'مسار المحامي'),
          React.createElement(
            Text,
            { style: styles.subtitle },
            payload.taxNumber ? `فاتورة ضريبية ${safeNumber}` : `فاتورة ${safeNumber}`,
          ),
        ),
        payload.logoUrl
          ? React.createElement(Image, { style: styles.logo, src: payload.logoUrl })
          : null,
      ),

      React.createElement(
        View,
        { style: styles.infoRow },
        React.createElement(
          View,
          { style: styles.infoBlock },
          React.createElement(Text, { style: styles.infoTitle }, 'من:'),
          React.createElement(Text, { style: styles.infoText }, payload.orgName || 'إدارة المكتب'),
          payload.orgAddress
            ? React.createElement(Text, { style: styles.infoText }, payload.orgAddress)
            : null,
          payload.taxNumber
            ? React.createElement(Text, { style: styles.infoText }, `الرقم الضريبي: ${payload.taxNumber}`)
            : null,
          payload.crNumber
            ? React.createElement(Text, { style: styles.infoText }, `الرقم السجل التجاري: ${payload.crNumber}`)
            : null,
        ),
        React.createElement(
          View,
          { style: styles.infoBlock },
          React.createElement(Text, { style: styles.infoTitle }, 'إلى:'),
          React.createElement(Text, { style: styles.infoText }, payload.clientName || 'العميل'),
          payload.clientAddress
            ? React.createElement(Text, { style: styles.infoText }, payload.clientAddress)
            : null,
        ),
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'العميل'),
          React.createElement(Text, { style: styles.value }, payload.clientName ?? '—'),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'تاريخ الإصدار'),
          React.createElement(Text, { style: styles.value }, formatDate(payload.issued_at)),
        ),
        payload.due_at
          ? React.createElement(
            View,
            { style: styles.row },
            React.createElement(Text, { style: styles.label }, 'تاريخ الاستحقاق'),
            React.createElement(Text, { style: styles.value }, formatDate(payload.due_at)),
          )
          : null,
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.cellDesc }, 'الوصف'),
          React.createElement(Text, { style: styles.cellQty }, 'الكمية'),
          React.createElement(Text, { style: styles.cellUnit }, 'سعر الوحدة'),
          React.createElement(Text, { style: styles.cellTotal }, 'الإجمالي'),
        ),
        ...items.map((item, index) => {
          const lineTotal = round2(item.qty * item.unit_price);
          return React.createElement(
            View,
            { key: String(index), style: styles.tableRow },
            React.createElement(Text, { style: styles.cellDesc }, item.desc),
            React.createElement(Text, { style: styles.cellQty }, String(item.qty)),
            React.createElement(
              Text,
              { style: styles.cellUnit },
              `${formatMoney(item.unit_price)} ${payload.currency}`,
            ),
            React.createElement(
              Text,
              { style: styles.cellTotal },
              `${formatMoney(lineTotal)} ${payload.currency}`,
            ),
          );
        }),
        React.createElement(
          View,
          { style: styles.totals },
          React.createElement(
            View,
            { style: styles.row },
            React.createElement(Text, { style: styles.label }, 'المجموع الفرعي'),
            React.createElement(
              Text,
              { style: styles.value },
              `${formatMoney(payload.subtotal)} ${payload.currency}`,
            ),
          ),
          React.createElement(
            View,
            { style: styles.row },
            React.createElement(Text, { style: styles.label }, 'الضريبة'),
            React.createElement(
              Text,
              { style: styles.value },
              `${formatMoney(payload.tax)} ${payload.currency}`,
            ),
          ),
          React.createElement(
            View,
            { style: styles.row },
            React.createElement(Text, { style: styles.label }, 'الإجمالي'),
            React.createElement(
              Text,
              { style: styles.value },
              `${formatMoney(payload.total)} ${payload.currency}`,
            ),
          ),
          React.createElement(
            View,
            { style: styles.row },
            React.createElement(Text, { style: styles.label }, 'الحالة'),
            React.createElement(Text, { style: styles.value }, translateStatus(payload.status)),
          ),
          React.createElement(
            View,
            { style: styles.row },
            React.createElement(Text, { style: styles.label }, 'المدفوع'),
            React.createElement(
              Text,
              { style: styles.value },
              `${formatMoney(payload.paidAmount)} ${payload.currency}`,
            ),
          ),
          React.createElement(
            View,
            { style: styles.row },
            React.createElement(Text, { style: styles.label }, 'المتبقي'),
            React.createElement(
              Text,
              { style: styles.value },
              `${formatMoney(payload.remaining)} ${payload.currency}`,
            ),
          ),
        ),
      ),
      payload.qrCode
        ? React.createElement(
          View,
          { style: styles.qrCode },
          React.createElement(Image, {
            src: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payload.qrCode)}`,
          }),
        )
        : null,
      React.createElement(
        Text,
        { style: styles.note },
        'هذه الفاتورة صادرة من مسار المحامي. قد تختلف الأرقام عن العرض حسب تحديث البنود والدفعات.',
      ),
    ),
  );

  const buffer = await withCircuitBreaker(
    'pdf.invoice_export',
    { failureThreshold: 3, cooldownMs: 30_000 },
    () =>
      withTimeout(
        pdf(PdfDocument).toBuffer(),
        8_000,
        'تعذر تصدير PDF. حاول مرة أخرى.',
      ),
  );

  return {
    buffer: buffer as unknown as Buffer,
    fileName: toSafeFileName(`invoice-${safeNumber}.pdf`),
  };
}

export { CircuitOpenError, TimeoutError };

function normalizeItems(value: any): InvoicePdfItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      desc: String(item?.desc ?? '').trim() || '—',
      qty: Number(item?.qty ?? 0) || 0,
      unit_price: Number(item?.unit_price ?? 0) || 0,
    }))
    .filter((item) => item.desc && item.qty > 0)
    .slice(0, 80);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

const statusMap: Record<string, string> = {
  unpaid: 'غير مسددة',
  partial: 'مسددة جزئياً',
  paid: 'مدفوعة',
  void: 'ملغاة',
};

function translateStatus(status: string): string {
  return statusMap[status] ?? status;
}

function formatMoney(value: string | number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(numberValue) ? numberValue : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toSafeFileName(value: string) {
  return value
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}
