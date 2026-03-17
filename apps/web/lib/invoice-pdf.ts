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

// ── Colors ──────────────────────────────────
const COLORS = {
  navy: '#0f172a',
  navyLight: '#1e293b',
  emerald: '#10b981',
  emeraldDark: '#065f46',
  emeraldBg: '#ecfdf5',
  amberDark: '#92400e',
  amberBg: '#fffbeb',
  redDark: '#991b1b',
  redBg: '#fef2f2',
  grayBg: '#f8fafc',
  grayBorder: '#e2e8f0',
  grayText: '#64748b',
  darkText: '#0f172a',
  bodyText: '#334155',
  white: '#ffffff',
  rowAlt: '#f1f5f9',
};

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  unpaid: { bg: COLORS.redBg, text: COLORS.redDark, label: 'غير مسددة' },
  partial: { bg: COLORS.amberBg, text: COLORS.amberDark, label: 'مسددة جزئياً' },
  paid: { bg: COLORS.emeraldBg, text: COLORS.emeraldDark, label: 'مدفوعة' },
  void: { bg: COLORS.grayBg, text: COLORS.grayText, label: 'ملغاة' },
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

  const s = StyleSheet.create({
    // ── Page ──
    page: {
      padding: 0,
      fontSize: 11,
      fontFamily: 'IBM Plex Sans Arabic',
      color: COLORS.darkText,
      direction: 'rtl',
    },

    // ── Header Banner ──
    headerBanner: {
      backgroundColor: COLORS.navy,
      paddingHorizontal: 32,
      paddingTop: 28,
      paddingBottom: 24,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {},
    orgName: {
      fontSize: 20,
      fontWeight: 700,
      color: COLORS.white,
    },
    invoiceType: {
      fontSize: 11,
      color: COLORS.emerald,
      marginTop: 4,
      fontWeight: 700,
    },
    invoiceNumber: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 2,
    },
    logo: {
      width: 60,
      height: 60,
      objectFit: 'contain' as any,
      borderRadius: 8,
    },

    // ── Accent bar ──
    accentBar: {
      height: 4,
      backgroundColor: COLORS.emerald,
    },

    // ── Content wrapper ──
    content: {
      paddingHorizontal: 32,
      paddingTop: 20,
      paddingBottom: 24,
    },

    // ── Info Cards Row ──
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 20,
    },
    infoCard: {
      width: '48%',
      backgroundColor: COLORS.grayBg,
      border: `1px solid ${COLORS.grayBorder}`,
      borderRadius: 10,
      padding: 14,
    },
    infoLabel: {
      fontSize: 9,
      color: COLORS.emeraldDark,
      fontWeight: 700,
      marginBottom: 6,
      textTransform: 'uppercase' as any,
    },
    infoText: {
      fontSize: 10,
      color: COLORS.navyLight,
      lineHeight: 1.6,
    },
    infoBold: {
      fontSize: 11,
      color: COLORS.darkText,
      fontWeight: 700,
      marginBottom: 2,
    },

    // ── Dates & Status Strip ──
    detailStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: COLORS.grayBg,
      border: `1px solid ${COLORS.grayBorder}`,
      borderRadius: 10,
      padding: 12,
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    detailItem: {
      alignItems: 'center' as any,
    },
    detailLabel: {
      fontSize: 8,
      color: COLORS.grayText,
      marginBottom: 2,
    },
    detailValue: {
      fontSize: 11,
      fontWeight: 700,
      color: COLORS.darkText,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 700,
    },

    // ── Table ──
    tableWrapper: {
      border: `1px solid ${COLORS.grayBorder}`,
      borderRadius: 10,
      overflow: 'hidden' as any,
      marginBottom: 18,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: COLORS.navy,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    thText: {
      color: COLORS.white,
      fontWeight: 700,
      fontSize: 10,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderBottom: `1px solid ${COLORS.grayBorder}`,
    },
    tableRowAlt: {
      backgroundColor: COLORS.rowAlt,
    },
    tdText: {
      fontSize: 10,
      color: COLORS.bodyText,
    },
    cellDesc: { width: '44%' },
    cellQty: { width: '14%', textAlign: 'center' },
    cellUnit: { width: '21%', textAlign: 'right' },
    cellTotal: { width: '21%', textAlign: 'right' },

    // ── Totals ──
    totalsWrapper: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 20,
    },
    totalsCard: {
      width: '52%',
      border: `1px solid ${COLORS.grayBorder}`,
      borderRadius: 10,
      overflow: 'hidden' as any,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderBottom: `1px solid ${COLORS.grayBorder}`,
    },
    totalLabel: {
      fontSize: 10,
      color: COLORS.grayText,
    },
    totalValue: {
      fontSize: 10,
      fontWeight: 700,
      color: COLORS.darkText,
    },
    grandTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: COLORS.navy,
    },
    grandTotalLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: COLORS.white,
    },
    grandTotalValue: {
      fontSize: 12,
      fontWeight: 700,
      color: COLORS.emerald,
    },
    remainingPositive: {
      color: COLORS.redDark,
    },

    // ── QR Section ──
    qrSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
      padding: 14,
      backgroundColor: COLORS.grayBg,
      border: `1px solid ${COLORS.grayBorder}`,
      borderRadius: 10,
    },
    qrImage: {
      width: 72,
      height: 72,
    },
    qrText: {
      fontSize: 9,
      color: COLORS.grayText,
      lineHeight: 1.6,
    },
    qrTitle: {
      fontSize: 10,
      fontWeight: 700,
      color: COLORS.darkText,
      marginBottom: 4,
    },

    // ── Footer ──
    footer: {
      marginTop: 'auto' as any,
      borderTop: `1px solid ${COLORS.grayBorder}`,
      paddingTop: 14,
      paddingHorizontal: 32,
      paddingBottom: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerText: {
      fontSize: 8,
      color: COLORS.grayText,
      lineHeight: 1.8,
    },
    footerBrand: {
      fontSize: 9,
      color: COLORS.emeraldDark,
      fontWeight: 700,
    },
  });

  const items = normalizeItems(payload.items);
  const safeNumber = String(payload.number ?? '').trim() || 'invoice';
  const currentStatus = statusStyles[payload.status] ?? statusStyles.unpaid;
  const isTaxInvoice = Boolean(payload.taxNumber);

  const el = React.createElement;

  const PdfDocument = el(
    Document,
    {},
    el(
      Page,
      { size: 'A4', style: s.page },

      // ── Header Banner ──
      el(
        View,
        { style: s.headerBanner },
        el(
          View,
          { style: s.headerLeft },
          el(Text, { style: s.orgName }, payload.orgName ?? 'مسار المحامي'),
          el(
            Text,
            { style: s.invoiceType },
            isTaxInvoice ? 'فاتورة ضريبية' : 'فاتورة',
          ),
          el(Text, { style: s.invoiceNumber }, `رقم: ${safeNumber}`),
        ),
        payload.logoUrl
          ? el(Image, { style: s.logo, src: payload.logoUrl })
          : null,
      ),

      // ── Accent Bar ──
      el(View, { style: s.accentBar }),

      // ── Content ──
      el(
        View,
        { style: s.content },

        // ── From / To Info Cards ──
        el(
          View,
          { style: s.infoRow },
          // From
          el(
            View,
            { style: s.infoCard },
            el(Text, { style: s.infoLabel }, 'من'),
            el(Text, { style: s.infoBold }, payload.orgName || 'إدارة المكتب'),
            payload.orgAddress
              ? el(Text, { style: s.infoText }, payload.orgAddress)
              : null,
            payload.taxNumber
              ? el(Text, { style: s.infoText }, `الرقم الضريبي: ${payload.taxNumber}`)
              : null,
            payload.crNumber
              ? el(Text, { style: s.infoText }, `السجل التجاري: ${payload.crNumber}`)
              : null,
          ),
          // To
          el(
            View,
            { style: s.infoCard },
            el(Text, { style: s.infoLabel }, 'إلى'),
            el(Text, { style: s.infoBold }, payload.clientName || 'العميل'),
            payload.clientAddress
              ? el(Text, { style: s.infoText }, payload.clientAddress)
              : null,
          ),
        ),

        // ── Dates & Status Strip ──
        el(
          View,
          { style: s.detailStrip },
          el(
            View,
            { style: s.detailItem },
            el(Text, { style: s.detailLabel }, 'تاريخ الإصدار'),
            el(Text, { style: s.detailValue }, formatDate(payload.issued_at)),
          ),
          payload.due_at
            ? el(
              View,
              { style: s.detailItem },
              el(Text, { style: s.detailLabel }, 'تاريخ الاستحقاق'),
              el(Text, { style: s.detailValue }, formatDate(payload.due_at)),
            )
            : null,
          el(
            View,
            { style: s.detailItem },
            el(Text, { style: s.detailLabel }, 'الحالة'),
            el(
              Text,
              {
                style: {
                  ...s.statusBadge,
                  backgroundColor: currentStatus.bg,
                  color: currentStatus.text,
                },
              },
              currentStatus.label,
            ),
          ),
        ),

        // ── Items Table ──
        el(
          View,
          { style: s.tableWrapper },
          // Header
          el(
            View,
            { style: s.tableHeader },
            el(Text, { style: { ...s.thText, ...s.cellDesc } }, 'الوصف'),
            el(Text, { style: { ...s.thText, ...s.cellQty } }, 'الكمية'),
            el(Text, { style: { ...s.thText, ...s.cellUnit } }, 'سعر الوحدة'),
            el(Text, { style: { ...s.thText, ...s.cellTotal } }, 'الإجمالي'),
          ),
          // Rows
          ...items.map((item, index) => {
            const lineTotal = round2(item.qty * item.unit_price);
            const isAlt = index % 2 === 1;
            return el(
              View,
              {
                key: String(index),
                style: isAlt ? { ...s.tableRow, ...s.tableRowAlt } : s.tableRow,
              },
              el(Text, { style: { ...s.tdText, ...s.cellDesc } }, item.desc),
              el(Text, { style: { ...s.tdText, ...s.cellQty } }, String(item.qty)),
              el(
                Text,
                { style: { ...s.tdText, ...s.cellUnit } },
                `${formatMoney(item.unit_price)} ${payload.currency}`,
              ),
              el(
                Text,
                { style: { ...s.tdText, ...s.cellTotal, fontWeight: 700 } },
                `${formatMoney(lineTotal)} ${payload.currency}`,
              ),
            );
          }),
        ),

        // ── Totals Card ──
        el(
          View,
          { style: s.totalsWrapper },
          el(
            View,
            { style: s.totalsCard },
            // Subtotal
            el(
              View,
              { style: s.totalRow },
              el(Text, { style: s.totalLabel }, 'المجموع الفرعي'),
              el(Text, { style: s.totalValue }, `${formatMoney(payload.subtotal)} ${payload.currency}`),
            ),
            // Tax
            el(
              View,
              { style: s.totalRow },
              el(Text, { style: s.totalLabel }, 'الضريبة (VAT)'),
              el(Text, { style: s.totalValue }, `${formatMoney(payload.tax)} ${payload.currency}`),
            ),
            // Grand Total
            el(
              View,
              { style: s.grandTotalRow },
              el(Text, { style: s.grandTotalLabel }, 'الإجمالي المستحق'),
              el(Text, { style: s.grandTotalValue }, `${formatMoney(payload.total)} ${payload.currency}`),
            ),
            // Paid
            el(
              View,
              { style: s.totalRow },
              el(Text, { style: s.totalLabel }, 'المدفوع'),
              el(
                Text,
                { style: { ...s.totalValue, color: COLORS.emeraldDark } },
                `${formatMoney(payload.paidAmount)} ${payload.currency}`,
              ),
            ),
            // Remaining
            el(
              View,
              { style: { ...s.totalRow, borderBottom: 'none' } },
              el(Text, { style: s.totalLabel }, 'المتبقي'),
              el(
                Text,
                {
                  style: {
                    ...s.totalValue,
                    ...(payload.remaining > 0 ? s.remainingPositive : {}),
                  },
                },
                `${formatMoney(payload.remaining)} ${payload.currency}`,
              ),
            ),
          ),
        ),

        // ── QR Code Section ──
        payload.qrCode
          ? el(
            View,
            { style: s.qrSection },
            el(Image, {
              style: s.qrImage,
              src: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payload.qrCode)}`,
            }),
            el(
              View,
              {},
              el(Text, { style: s.qrTitle }, 'رمز التحقق من الفاتورة'),
              el(Text, { style: s.qrText }, 'امسح الرمز ضوئياً للتحقق من صحة الفاتورة'),
              isTaxInvoice
                ? el(Text, { style: s.qrText }, 'أو تحقق عبر هيئة الزكاة والضريبة والجمارك')
                : null,
            ),
          )
          : null,
      ),

      // ── Footer ──
      el(
        View,
        { style: s.footer },
        el(
          View,
          {},
          el(Text, { style: s.footerBrand }, payload.orgName ?? 'مسار المحامي'),
          el(Text, { style: s.footerText }, 'هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع أو ختم.'),
        ),
        el(
          View,
          { style: { alignItems: 'flex-end' as any } },
          el(Text, { style: s.footerText }, `رقم الفاتورة: ${safeNumber}`),
          el(Text, { style: s.footerText }, `تاريخ الإصدار: ${formatDate(payload.issued_at)}`),
        ),
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
