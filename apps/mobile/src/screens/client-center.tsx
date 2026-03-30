import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import {
  Card,
  EmptyState,
  Field,
  HeroCard,
  LoadingBlock,
  Page,
  PrimaryButton,
  SectionTitle,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  buildClientPortalInvoicePdfUrl,
  buildClientPortalQuotePdfUrl,
  requestClientPortalAccountDeletion,
  requestClientPortalDocumentDownloadUrl,
  submitClientPortalRequest,
  uploadClientPortalDocument,
} from '../features/client/api';
import type {
  ClientPortalDocument,
  ClientPortalInvoice,
  ClientPortalQuote,
  ClientPortalRequestItem,
} from '../features/client/types';
import {
  exportRemoteFileToDevice,
  openRemoteFileInApp,
  shareRemoteFileFromDevice,
} from '../lib/file-actions';
import { formatCurrency, formatDateTime } from '../lib/format';
import { openPrivacyPolicy, openSupportPage, openTermsOfService } from '../lib/legal-links';
import { colors } from '../theme';
import {
  QuickButton,
  SummaryRow,
  notificationTone,
  requestSourceLabel,
  statusTone,
  styles,
  useClientOverviewData,
} from './client';

export function ClientCenterScreen() {
  const { session, signOut } = useAuth();
  const { data, loading, error, refresh, token } = useClientOverviewData();
  const [requestSubject, setRequestSubject] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadMatterId, setUploadMatterId] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    mimeType?: string | null;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handlePickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset) {
      return;
    }

    setSelectedFile({
      uri: asset.uri,
      name: asset.name || 'document',
      mimeType: asset.mimeType || null,
    });
  }

  async function handleUpload() {
    if (!token) return;
    if (!selectedFile) {
      setUploadError('اختر ملفًا أولًا قبل الرفع.');
      return;
    }

    const title = uploadTitle.trim() || selectedFile.name;
    setUploading(true);
    setUploadError('');

    try {
      await uploadClientPortalDocument(token, {
        title,
        matterId: uploadMatterId || null,
        file: selectedFile,
      });
      setUploadTitle('');
      setUploadMatterId('');
      setSelectedFile(null);
      Alert.alert('تم الرفع', 'تم رفع المستند بنجاح وسيظهر ضمن ملفاتك.');
      refresh();
    } catch (nextError) {
      setUploadError(nextError instanceof Error ? nextError.message : 'تعذر رفع المستند الآن.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRequestSubmit() {
    if (!token) return;

    const subject = requestSubject.trim();
    const message = requestMessage.trim();
    if (subject.length < 2 || message.length < 5) {
      setRequestError('أدخل عنوانًا ووصفًا واضحين قبل إرسال الطلب.');
      return;
    }

    setRequestLoading(true);
    setRequestError('');

    try {
      await submitClientPortalRequest(token, { subject, message });
      setRequestSubject('');
      setRequestMessage('');
      Alert.alert('تم الإرسال', 'تم إرسال طلبك إلى المكتب بنجاح.');
      refresh();
    } catch (nextError) {
      setRequestError(nextError instanceof Error ? nextError.message : 'تعذر إرسال الطلب الآن.');
    } finally {
      setRequestLoading(false);
    }
  }

  async function resolveDocumentDownload(document: ClientPortalDocument) {
    if (!token) {
      throw new Error('انتهت جلسة الدخول. أعد تسجيل الدخول ثم حاول مرة أخرى.');
    }
    if (!document.latest_version?.storage_path) {
      throw new Error('لا توجد نسخة قابلة للتنزيل لهذا المستند.');
    }

    const payload = await requestClientPortalDocumentDownloadUrl(token, document.latest_version.storage_path);
    return {
      url: payload.signedDownloadUrl,
      fileName: document.latest_version.file_name || `${document.title}.pdf`,
      mimeType: document.latest_version.mime_type,
    };
  }

  async function handleViewDocument(document: ClientPortalDocument) {
    try {
      const remote = await resolveDocumentDownload(document);
      await openRemoteFileInApp(remote);
    } catch (nextError) {
      Alert.alert('تعذر العرض', nextError instanceof Error ? nextError.message : 'تعذر عرض المستند الآن.');
    }
  }

  async function handleDownloadDocument(document: ClientPortalDocument) {
    try {
      const remote = await resolveDocumentDownload(document);
      await exportRemoteFileToDevice(remote);
      Alert.alert('تم تجهيز الملف', 'يمكنك الآن حفظه أو نقله إلى تطبيقات الجهاز.');
    } catch (nextError) {
      Alert.alert('تعذر التنزيل', nextError instanceof Error ? nextError.message : 'تعذر تنزيل المستند الآن.');
    }
  }

  async function handleShareDocument(document: ClientPortalDocument) {
    try {
      const remote = await resolveDocumentDownload(document);
      await shareRemoteFileFromDevice(remote);
    } catch (nextError) {
      Alert.alert('تعذر المشاركة', nextError instanceof Error ? nextError.message : 'تعذر مشاركة المستند الآن.');
    }
  }

  async function handleViewPdf(url: string, fileName: string) {
    try {
      await openRemoteFileInApp({ url, fileName, mimeType: 'application/pdf' });
    } catch (nextError) {
      Alert.alert('تعذر الفتح', nextError instanceof Error ? nextError.message : 'تعذر فتح الملف حالياً.');
    }
  }

  async function handleDownloadPdf(url: string, fileName: string) {
    try {
      await exportRemoteFileToDevice({ url, fileName, mimeType: 'application/pdf' });
      Alert.alert('تم تجهيز الملف', 'يمكنك الآن حفظه أو نقله إلى تطبيقات الجهاز.');
    } catch (nextError) {
      Alert.alert('تعذر التنزيل', nextError instanceof Error ? nextError.message : 'تعذر تنزيل الملف حالياً.');
    }
  }

  async function handleSharePdf(url: string, fileName: string) {
    try {
      await shareRemoteFileFromDevice({ url, fileName, mimeType: 'application/pdf' });
    } catch (nextError) {
      Alert.alert('تعذر المشاركة', nextError instanceof Error ? nextError.message : 'تعذر مشاركة الملف حالياً.');
    }
  }

  function renderPdfActions(kind: 'invoice' | 'quote', item: ClientPortalInvoice | ClientPortalQuote) {
    if (!token) return undefined;

    const url = kind === 'invoice'
      ? buildClientPortalInvoicePdfUrl(token, item.id)
      : buildClientPortalQuotePdfUrl(token, item.id);
    const fileName = `${kind === 'invoice' ? 'invoice' : 'quote'}-${item.number}.pdf`;

    return (
      <View style={styles.linkGroup}>
        <Pressable onPress={() => void handleViewPdf(url, fileName)}>
          <Text style={styles.linkButton}>عرض</Text>
        </Pressable>
        <Pressable onPress={() => void handleDownloadPdf(url, fileName)}>
          <Text style={styles.linkButton}>تحميل</Text>
        </Pressable>
        <Pressable onPress={() => void handleSharePdf(url, fileName)}>
          <Text style={styles.linkButton}>مشاركة</Text>
        </Pressable>
      </View>
    );
  }

  function renderDocumentActions(document: ClientPortalDocument) {
    if (!document.latest_version?.storage_path) {
      return undefined;
    }

    return (
      <View style={styles.linkGroup}>
        <Pressable onPress={() => void handleViewDocument(document)}>
          <Text style={styles.linkButton}>عرض</Text>
        </Pressable>
        <Pressable onPress={() => void handleDownloadDocument(document)}>
          <Text style={styles.linkButton}>تحميل</Text>
        </Pressable>
        <Pressable onPress={() => void handleShareDocument(document)}>
          <Text style={styles.linkButton}>مشاركة</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <Page>
        <LoadingBlock />
      </Page>
    );
  }

  if (!data) {
    return (
      <Page>
        <EmptyState title="تعذر تحميل المركز" message={error || 'لا توجد بيانات متاحة حالياً.'} />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow="مركز الخدمة"
        title={data.bootstrap.client.name}
        subtitle="المستندات، الفواتير، العروض، التنبيهات، والطلبات في مكان واحد."
        aside={<StatusChip label={`${data.notifications.length} إشعار`} tone="gold" />}
      />

      <Card>
        <SectionTitle title="المستندات" subtitle="الملفات المعتمدة لك، مع إمكانية رفع ملفات جديدة." action={<Pressable onPress={refresh}><Text style={styles.linkButton}>تحديث</Text></Pressable>} />
        {data.bootstrap.documents.length ? (
          data.bootstrap.documents.map((document) => (
            <SummaryRow
              key={document.id}
              title={document.title}
              subtitle={[
                document.matter_title || 'ملف عام',
                document.latest_version?.file_name || 'بدون نسخة',
              ].join(' · ')}
              status={document.source || 'مستند'}
              tone={document.source ? 'gold' : 'success'}
              action={renderDocumentActions(document)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد مستندات" message="سيظهر هنا كل مستند معتمد يتيحه لك المكتب." />
        )}

        <View style={styles.formBlock}>
          <Text style={styles.formTitle}>رفع مستند جديد</Text>
          <Field label="عنوان المستند" value={uploadTitle} onChangeText={setUploadTitle} placeholder="مثال: وكالة محدثة" />
          <View style={styles.chipsWrap}>
            {data.bootstrap.matters.slice(0, 6).map((matter) => {
              const selected = uploadMatterId === matter.id;
              return (
                <Pressable key={matter.id} onPress={() => setUploadMatterId(selected ? '' : matter.id)} style={[styles.choiceChip, selected && styles.choiceChipSelected]}>
                  <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{matter.title}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actionRow}>
            <QuickButton title={selectedFile ? selectedFile.name : 'اختيار ملف'} onPress={() => void handlePickDocument()} secondary />
            <QuickButton title={uploading ? 'جارٍ الرفع...' : 'رفع'} onPress={() => void handleUpload()} />
          </View>
          {uploadError ? <Text style={styles.error}>{uploadError}</Text> : null}
        </View>
      </Card>

      <Card>
        <SectionTitle title="الفواتير" subtitle="تنزيل نسخة PDF ومتابعة الحالة المالية." />
        {data.bootstrap.invoices.length ? (
          data.bootstrap.invoices.map((invoice) => (
            <SummaryRow
              key={invoice.id}
              title={`فاتورة ${invoice.number}`}
              subtitle={[
                invoice.matter_title || 'بدون قضية',
                `المتبقي ${formatCurrency(invoice.remaining_amount, invoice.currency || 'SAR')}`,
              ].join(' · ')}
              status={invoice.status}
              tone={statusTone(invoice.status)}
              action={renderPdfActions('invoice', invoice)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد فواتير" message="لم يتم إصدار فواتير مرتبطة بحسابك حتى الآن." />
        )}
      </Card>

      <Card>
        <SectionTitle title="عروض الأسعار" subtitle="فتح نسخة PDF ومتابعة حالة الاعتماد." />
        {data.bootstrap.quotes.length ? (
          data.bootstrap.quotes.map((quote) => (
            <SummaryRow
              key={quote.id}
              title={`عرض ${quote.number}`}
              subtitle={[
                quote.matter_title || 'بدون قضية',
                formatCurrency(quote.total, quote.currency || 'SAR'),
              ].join(' · ')}
              status={quote.status}
              tone={statusTone(quote.status)}
              action={renderPdfActions('quote', quote)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد عروض أسعار" message="ستظهر هنا عروض الأسعار المرتبطة بحسابك." />
        )}
      </Card>

      <Card>
        <SectionTitle title="الإشعارات" subtitle="آخر المستجدات من المكتب على حسابك." />
        {data.notifications.length ? (
          data.notifications.map((item) => (
            <SummaryRow
              key={item.id}
              title={item.title}
              subtitle={[item.body, formatDateTime(item.created_at)].filter(Boolean).join(' · ')}
              status={item.kind}
              tone={notificationTone(item.kind)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد إشعارات" message="لا توجد إشعارات حديثة لحسابك الآن." />
        )}
      </Card>

      <Card>
        <SectionTitle title="الطلبات والاستفسارات" subtitle="أرسل طلبًا جديدًا وراجع الطلبات السابقة." />
        {data.requests.length ? (
          data.requests.map((item: ClientPortalRequestItem) => (
            <SummaryRow
              key={item.id}
              title={item.firm_name || 'طلب جديد'}
              subtitle={[item.message || 'بدون وصف إضافي', formatDateTime(item.created_at)].join(' · ')}
              status={requestSourceLabel(item.source)}
              tone="gold"
            />
          ))
        ) : (
          <EmptyState title="لا توجد طلبات" message="يمكنك إرسال أول طلب أو استفسار للمكتب من هنا." />
        )}

        <View style={styles.formBlock}>
          <Field label="عنوان الطلب" value={requestSubject} onChangeText={setRequestSubject} placeholder="مثال: طلب تحديث على الفاتورة" />
          <Text style={styles.fieldLabel}>تفاصيل الطلب</Text>
          <TextInput
            value={requestMessage}
            onChangeText={setRequestMessage}
            placeholder="اشرح المطلوب أو الاستفسار بالتفصيل"
            placeholderTextColor={colors.textMuted}
            style={[styles.search, styles.multilineInput]}
            multiline
            textAlign="right"
          />
          {requestError ? <Text style={styles.error}>{requestError}</Text> : null}
          <PrimaryButton title={requestLoading ? 'جارٍ الإرسال...' : 'إرسال الطلب'} onPress={() => void handleRequestSubmit()} disabled={requestLoading} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="الحساب" subtitle="بيانات الدخول والدعم." />
        <SummaryRow title={data.bootstrap.client.name} subtitle={session?.email || data.bootstrap.client.email || '—'} />
        <SummaryRow title="الجوال" subtitle={data.bootstrap.client.phone || 'غير مسجل'} />
        <SummaryRow title="الهوية / السجل" subtitle={data.bootstrap.client.identity_no || data.bootstrap.client.commercial_no || 'غير متوفر'} />
        <View style={styles.actionRow}>
          <PrimaryButton title="الدعم" onPress={() => void openSupportPage()} secondary />
          <PrimaryButton title="الشروط" onPress={() => void openTermsOfService()} secondary />
        </View>
        <View style={styles.actionRow}>
          <PrimaryButton title="الخصوصية" onPress={() => void openPrivacyPolicy()} secondary />
          <PrimaryButton
            title="طلب حذف الحساب"
            onPress={() =>
              Alert.alert(
                'طلب حذف الحساب',
                'سيتم إرسال طلب حذف الحساب إلى المكتب مع التحقق من الهوية قبل التنفيذ. هل تريد المتابعة؟',
                [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'إرسال الطلب',
                    style: 'destructive',
                    onPress: () => {
                      if (!token) return;
                      void requestClientPortalAccountDeletion(token)
                        .then((response) => {
                          Alert.alert('تم الإرسال', response.message || 'تم إرسال طلب حذف الحساب.');
                        })
                        .catch((nextError) => {
                          Alert.alert('تعذر الإرسال', nextError instanceof Error ? nextError.message : 'تعذر إرسال الطلب.');
                        });
                    },
                  },
                ],
              )
            }
            secondary
          />
        </View>
        <Pressable onPress={() => void signOut()} style={styles.logout}>
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </Pressable>
      </Card>
    </Page>
  );
}

export const ClientProfileScreen = ClientCenterScreen;
