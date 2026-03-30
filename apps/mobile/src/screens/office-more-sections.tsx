import { Pressable, Text, TextInput, View } from 'react-native';
import {
  type OfficeBillingResponse,
  type OfficeDocument,
  type OfficeInvoiceDetails,
  type OfficeNotification,
  type OfficeQuoteDetails,
  type OfficeTask,
  type OfficeTaskWritePayload,
} from '../features/office/api';
import {
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  PrimaryButton,
  SectionTitle,
  StatusChip,
} from '../components/ui';
import { colors } from '../theme';
import { formatCurrency, formatDate, formatDateTime } from '../lib/format';
import { styles } from './office.styles';
import { billingTone, notificationTone, taskTone } from './office.utils';
import { Meta, SummaryRow } from './office';

export type OfficeBillingPreview =
  | { kind: 'invoice'; invoice: OfficeInvoiceDetails['invoice']; payments: OfficeInvoiceDetails['payments'] }
  | { kind: 'quote'; quote: OfficeQuoteDetails['quote'] }
  | null;

type OfficeMoreTasksSectionProps = {
  tasks: OfficeTask[];
  onOpenTask: (task: OfficeTask) => void;
  onMarkDone: (task: OfficeTask) => void;
  onArchiveTask: (task: OfficeTask) => void;
};

export function OfficeMoreTasksSection({ tasks, onOpenTask, onMarkDone, onArchiveTask }: OfficeMoreTasksSectionProps) {
  return (
    <Card>
      <SectionTitle title="مهامي الحالية" subtitle="المسندة لك أو الأقرب للاستحقاق." />
      {tasks.length ? (
        tasks.map((task) => (
          <View key={task.id} style={styles.controlRow}>
            <Pressable style={styles.controlRowMain} onPress={() => onOpenTask(task)}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{task.title}</Text>
                <Text style={styles.rowMeta}>
                  {[
                    task.matter_title || 'بدون قضية',
                    task.due_at ? `الاستحقاق ${formatDate(task.due_at)}` : 'بدون تاريخ',
                  ].join(' · ')}
                </Text>
              </View>
              <StatusChip label={task.is_overdue ? 'متأخرة' : task.status} tone={taskTone(task)} />
            </Pressable>
            <View style={styles.inlineActionRow}>
              <Pressable style={styles.inlineAction} onPress={() => onMarkDone(task)}>
                <Text style={styles.inlineActionText}>تم</Text>
              </Pressable>
              <Pressable style={styles.inlineAction} onPress={() => onArchiveTask(task)}>
                <Text style={styles.inlineActionText}>أرشفة</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <EmptyState title="لا توجد مهام" message="لا توجد مهام إضافية معروضة لك حاليًا." />
      )}
    </Card>
  );
}

type OfficeMoreDocumentsSectionProps = {
  documents: OfficeDocument[];
  onViewDocument: (document: OfficeDocument) => void;
  onDownloadDocument: (document: OfficeDocument) => void;
  onShareDocument: (document: OfficeDocument) => void;
  onAddDocumentVersion: (document: OfficeDocument) => void;
  onToggleDocumentArchive: (document: OfficeDocument) => void;
};

export function OfficeMoreDocumentsSection({
  documents,
  onViewDocument,
  onDownloadDocument,
  onShareDocument,
  onAddDocumentVersion,
  onToggleDocumentArchive,
}: OfficeMoreDocumentsSectionProps) {
  return (
    <Card>
      <SectionTitle title="المستندات" subtitle="آخر الملفات المتاحة على مستوى المكتب." />
      {documents.length ? (
        documents.map((document) => (
          <View key={document.id} style={styles.controlRow}>
            <View style={styles.controlRowMain}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{document.title}</Text>
                <Text style={styles.rowMeta}>
                  {[document.client_name || 'بدون عميل', document.latest_version?.file_name || 'بدون نسخة'].join(' · ')}
                </Text>
              </View>
              <StatusChip label={document.folder || 'مستند'} tone="default" />
            </View>
            <View style={styles.inlineActionRow}>
              <Pressable style={styles.inlineAction} onPress={() => onViewDocument(document)}>
                <Text style={styles.inlineActionText}>عرض</Text>
              </Pressable>
              <Pressable style={styles.inlineAction} onPress={() => onDownloadDocument(document)}>
                <Text style={styles.inlineActionText}>تحميل</Text>
              </Pressable>
              <Pressable style={styles.inlineAction} onPress={() => onShareDocument(document)}>
                <Text style={styles.inlineActionText}>مشاركة</Text>
              </Pressable>
              <Pressable style={styles.inlineAction} onPress={() => onAddDocumentVersion(document)}>
                <Text style={styles.inlineActionText}>نسخة</Text>
              </Pressable>
              <Pressable style={styles.inlineAction} onPress={() => onToggleDocumentArchive(document)}>
                <Text style={styles.inlineActionText}>{document.is_archived ? 'استرجاع' : 'أرشفة'}</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <EmptyState title="لا توجد مستندات" message="لا توجد مستندات معروضة حاليًا." />
      )}
    </Card>
  );
}

type OfficeInvoiceRow = OfficeBillingResponse['invoices']['data'][number];
type OfficeQuoteRow = OfficeBillingResponse['quotes']['data'][number];

type OfficeMoreBillingSectionProps = {
  billing: OfficeBillingResponse | null;
  billingPreview: OfficeBillingPreview;
  billingPreviewLoading: boolean;
  invoiceEmailTo: string;
  invoiceEmailMessage: string;
  invoiceEmailSending: boolean;
  onOpenInvoice: (invoice: OfficeInvoiceRow) => void;
  onOpenQuote: (quote: OfficeQuoteRow) => void;
  onToggleInvoiceArchive: (invoice: OfficeInvoiceRow) => void;
  onViewBillingPdf: (kind: 'invoice' | 'quote', id: string, number: string) => void;
  onDownloadBillingPdf: (kind: 'invoice' | 'quote', id: string, number: string) => void;
  onShareBillingPdf: (kind: 'invoice' | 'quote', id: string, number: string) => void;
  onInvoiceEmailToChange: (value: string) => void;
  onInvoiceEmailMessageChange: (value: string) => void;
  onSendInvoiceEmail: () => void;
};

export function OfficeMoreBillingSection({
  billing,
  billingPreview,
  billingPreviewLoading,
  invoiceEmailTo,
  invoiceEmailMessage,
  invoiceEmailSending,
  onOpenInvoice,
  onOpenQuote,
  onToggleInvoiceArchive,
  onViewBillingPdf,
  onDownloadBillingPdf,
  onShareBillingPdf,
  onInvoiceEmailToChange,
  onInvoiceEmailMessageChange,
  onSendInvoiceEmail,
}: OfficeMoreBillingSectionProps) {
  return (
    <Card>
      <SectionTitle title="الفوترة والعروض" subtitle="آخر الفواتير وعروض الأسعار داخل نفس النظام." />

      {billing?.invoices.data.slice(0, 3).map((invoice) => (
        <View key={invoice.id} style={styles.controlRow}>
          <View style={styles.controlRowMain}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{`فاتورة ${invoice.number}`}</Text>
              <Text style={styles.rowMeta}>
                {[invoice.client_name || 'بدون عميل', formatCurrency(invoice.total, invoice.currency)].join(' · ')}
              </Text>
            </View>
            <StatusChip label={invoice.status} tone={billingTone(invoice.status)} />
          </View>
          <View style={styles.inlineActionRow}>
            <Pressable style={styles.inlineAction} onPress={() => onOpenInvoice(invoice)}>
              <Text style={styles.inlineActionText}>عرض</Text>
            </Pressable>
            <Pressable style={styles.inlineAction} onPress={() => onViewBillingPdf('invoice', invoice.id, invoice.number)}>
              <Text style={styles.inlineActionText}>PDF</Text>
            </Pressable>
            <Pressable style={styles.inlineAction} onPress={() => onToggleInvoiceArchive(invoice)}>
              <Text style={styles.inlineActionText}>{invoice.is_archived ? 'استرجاع' : 'أرشفة'}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {billing?.quotes.data.slice(0, 3).map((quote) => (
        <View key={quote.id} style={styles.controlRow}>
          <View style={styles.controlRowMain}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{`عرض ${quote.number}`}</Text>
              <Text style={styles.rowMeta}>
                {[quote.client_name || 'بدون عميل', formatCurrency(quote.total, quote.currency)].join(' · ')}
              </Text>
            </View>
            <StatusChip label={quote.status} tone={billingTone(quote.status)} />
          </View>
          <View style={styles.inlineActionRow}>
            <Pressable style={styles.inlineAction} onPress={() => onOpenQuote(quote)}>
              <Text style={styles.inlineActionText}>عرض</Text>
            </Pressable>
            <Pressable style={styles.inlineAction} onPress={() => onViewBillingPdf('quote', quote.id, quote.number)}>
              <Text style={styles.inlineActionText}>PDF</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {billingPreviewLoading ? <LoadingBlock /> : null}

      {billingPreview?.kind === 'invoice' ? (
        <View style={styles.itemBlock}>
          <SectionTitle
            title={`تفاصيل الفاتورة ${billingPreview.invoice.number}`}
            subtitle={[
              billingPreview.invoice.client?.name || billingPreview.invoice.client_name || 'بدون عميل',
              formatCurrency(billingPreview.invoice.total, billingPreview.invoice.currency),
            ].join(' · ')}
          />
          {billingPreview.invoice.items.map((item, index) => (
            <SummaryRow
              key={`${billingPreview.invoice.id}-item-${index}`}
              title={item.desc}
              subtitle={`الكمية ${item.qty} · سعر الوحدة ${formatCurrency(item.unit_price, billingPreview.invoice.currency)}`}
              status={formatCurrency(item.qty * item.unit_price, billingPreview.invoice.currency)}
              tone="gold"
            />
          ))}
          <View style={styles.metaGrid}>
            <Meta label="الإجمالي قبل الضريبة" value={formatCurrency(billingPreview.invoice.subtotal, billingPreview.invoice.currency)} />
            <Meta label="الضريبة" value={formatCurrency(billingPreview.invoice.tax, billingPreview.invoice.currency)} />
            <Meta label="تاريخ الإصدار" value={formatDate(billingPreview.invoice.issued_at)} />
            <Meta label="الاستحقاق" value={formatDate(billingPreview.invoice.due_at)} />
          </View>
          <View style={styles.inlineActionRow}>
            <Pressable
              style={styles.inlineAction}
              onPress={() => onViewBillingPdf('invoice', billingPreview.invoice.id, billingPreview.invoice.number)}
            >
              <Text style={styles.inlineActionText}>عرض PDF</Text>
            </Pressable>
            <Pressable
              style={styles.inlineAction}
              onPress={() => onDownloadBillingPdf('invoice', billingPreview.invoice.id, billingPreview.invoice.number)}
            >
              <Text style={styles.inlineActionText}>تحميل</Text>
            </Pressable>
            <Pressable
              style={styles.inlineAction}
              onPress={() => onShareBillingPdf('invoice', billingPreview.invoice.id, billingPreview.invoice.number)}
            >
              <Text style={styles.inlineActionText}>مشاركة</Text>
            </Pressable>
          </View>
          <View style={styles.formBlock}>
            <Text style={styles.formTitle}>إرسال الفاتورة بالبريد</Text>
            <Field
              label="البريد الإلكتروني"
              value={invoiceEmailTo}
              onChangeText={onInvoiceEmailToChange}
              placeholder="client@example.com"
              keyboardType="email-address"
            />
            <Text style={styles.fieldLabel}>رسالة إضافية</Text>
            <TextInput
              value={invoiceEmailMessage}
              onChangeText={onInvoiceEmailMessageChange}
              placeholder="يمكن تركها فارغة لاستخدام الرسالة الاحترافية الافتراضية"
              placeholderTextColor={colors.textMuted}
              style={styles.multiline}
              multiline
            />
            <PrimaryButton
              title={invoiceEmailSending ? 'جارٍ الإرسال...' : 'إرسال الفاتورة للعميل'}
              onPress={onSendInvoiceEmail}
              disabled={invoiceEmailSending}
            />
          </View>
          {billingPreview.payments.length ? (
            billingPreview.payments.map((payment) => (
              <SummaryRow
                key={payment.id}
                title={`دفعة ${formatCurrency(payment.amount, billingPreview.invoice.currency)}`}
                subtitle={[
                  payment.method || 'طريقة غير محددة',
                  formatDateTime(payment.paid_at || payment.created_at),
                  payment.note || 'بدون ملاحظة',
                ].join(' · ')}
                status="مسجل"
                tone="success"
              />
            ))
          ) : (
            <EmptyState title="لا توجد دفعات" message="لم يتم تسجيل أي دفعة على هذه الفاتورة حتى الآن." />
          )}
        </View>
      ) : null}

      {billingPreview?.kind === 'quote' ? (
        <View style={styles.itemBlock}>
          <SectionTitle
            title={`تفاصيل العرض ${billingPreview.quote.number}`}
            subtitle={[
              billingPreview.quote.client?.name || billingPreview.quote.client_name || 'بدون عميل',
              formatCurrency(billingPreview.quote.total, billingPreview.quote.currency),
            ].join(' · ')}
          />
          {billingPreview.quote.items.map((item, index) => (
            <SummaryRow
              key={`${billingPreview.quote.id}-item-${index}`}
              title={item.desc}
              subtitle={`الكمية ${item.qty} · سعر الوحدة ${formatCurrency(item.unit_price, billingPreview.quote.currency)}`}
              status={formatCurrency(item.qty * item.unit_price, billingPreview.quote.currency)}
              tone="gold"
            />
          ))}
          <View style={styles.metaGrid}>
            <Meta label="الإجمالي قبل الضريبة" value={formatCurrency(billingPreview.quote.subtotal, billingPreview.quote.currency)} />
            <Meta label="الضريبة" value={formatCurrency(billingPreview.quote.tax, billingPreview.quote.currency)} />
            <Meta label="الحالة" value={billingPreview.quote.status} />
            <Meta label="تاريخ الإنشاء" value={formatDate(billingPreview.quote.created_at)} />
          </View>
          <View style={styles.inlineActionRow}>
            <Pressable
              style={styles.inlineAction}
              onPress={() => onViewBillingPdf('quote', billingPreview.quote.id, billingPreview.quote.number)}
            >
              <Text style={styles.inlineActionText}>عرض PDF</Text>
            </Pressable>
            <Pressable
              style={styles.inlineAction}
              onPress={() => onDownloadBillingPdf('quote', billingPreview.quote.id, billingPreview.quote.number)}
            >
              <Text style={styles.inlineActionText}>تحميل</Text>
            </Pressable>
            <Pressable
              style={styles.inlineAction}
              onPress={() => onShareBillingPdf('quote', billingPreview.quote.id, billingPreview.quote.number)}
            >
              <Text style={styles.inlineActionText}>مشاركة</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!billing?.invoices.data.length && !billing?.quotes.data.length ? (
        <EmptyState title="لا توجد حركة فوترة" message="ستظهر هنا الفواتير والعروض عندما تتوفر." />
      ) : null}
    </Card>
  );
}

type OfficeMoreActivitySectionProps = {
  notifications: OfficeNotification[];
};

export function OfficeMoreActivitySection({ notifications }: OfficeMoreActivitySectionProps) {
  return (
    <Card>
      <SectionTitle title="النشاط الأخير" subtitle="الإشعارات الحديثة التي تحتاج مراجعة." />
      {notifications.slice(0, 3).map((item) => (
        <SummaryRow
          key={item.id}
          title={item.title}
          subtitle={[item.body || 'بدون تفاصيل', formatDateTime(item.created_at)].join(' · ')}
          status={item.category || item.source || 'نظام'}
          tone={notificationTone(item.category)}
        />
      ))}
      {!notifications.length ? (
        <EmptyState title="لا توجد إشعارات" message="ستظهر هنا آخر التنبيهات عندما تتوفر." />
      ) : null}
    </Card>
  );
}

export function toTaskWritePayload(task: OfficeTask): OfficeTaskWritePayload {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    matter_id: task.matter_id,
    due_at: task.due_at,
    priority: task.priority as OfficeTaskWritePayload['priority'],
    status: task.status as OfficeTaskWritePayload['status'],
  };
}
