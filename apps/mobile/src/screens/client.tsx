import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Card,
  EmptyState,
  Field,
  HeroCard,
  LoadingBlock,
  Page,
  PrimaryButton,
  SectionTitle,
  StatCard,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  buildClientPortalInvoicePdfUrl,
  buildClientPortalQuotePdfUrl,
  fetchClientPortalOverview,
  requestClientPortalAccountDeletion,
  requestClientPortalDocumentDownloadUrl,
  submitClientPortalCommunication,
  submitClientPortalRequest,
  uploadClientPortalDocument,
} from '../features/client/api';
import type {
  ClientPortalDocument,
  ClientPortalInvoice,
  ClientPortalMatter,
  ClientPortalMatterCommunication,
  ClientPortalNotificationItem,
  ClientPortalOverview,
  ClientPortalQuote,
  ClientPortalRequestItem,
} from '../features/client/types';
import {
  exportRemoteFileToDevice,
  openRemoteFileInApp,
  shareRemoteFileFromDevice,
} from '../lib/file-actions';
import { formatCurrency, formatDate, formatDateTime } from '../lib/format';
import { openPrivacyPolicy, openSupportPage, openTermsOfService } from '../lib/legal-links';
import { colors, fonts, radius, spacing } from '../theme';

export type ClientStackParamList = {
  ClientTabs: undefined;
  ClientMatterDetails: {
    matter: ClientPortalMatter;
  };
};

type ClientMatterDetailsProps = NativeStackScreenProps<ClientStackParamList, 'ClientMatterDetails'>;

function statusTone(status: string) {
  if (status === 'paid' || status === 'closed' || status === 'accepted') return 'success' as const;
  if (status === 'unpaid' || status === 'partial' || status === 'in_progress' || status === 'sent') return 'warning' as const;
  if (status === 'rejected' || status === 'void') return 'danger' as const;
  return 'default' as const;
}

function notificationTone(kind: ClientPortalNotificationItem['kind']) {
  if (kind === 'invoice') return 'warning' as const;
  if (kind === 'document') return 'success' as const;
  if (kind === 'request') return 'gold' as const;
  return 'default' as const;
}

function requestSourceLabel(source: string) {
  switch (source) {
    case 'contact':
      return 'تواصل';
    case 'support':
      return 'دعم';
    default:
      return source || 'طلب';
  }
}

function useClientOverviewData() {
  const { session } = useAuth();
  const [data, setData] = useState<ClientPortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');
      try {
        const payload = await fetchClientPortalOverview(session.token);
        if (mounted) {
          setData(payload);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل بوابة العميل.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [refreshIndex, session?.token]);

  return {
    data,
    loading,
    error,
    refresh: () => setRefreshIndex((value) => value + 1),
    token: session?.token || null,
  };
}

function SummaryRow({
  title,
  subtitle,
  status,
  tone = 'default',
  action,
}: {
  title: string;
  subtitle: string;
  status?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{subtitle}</Text>
      </View>
      <View style={styles.rowActions}>
        {status ? <StatusChip label={status} tone={tone} /> : null}
        {action}
      </View>
    </View>
  );
}

function QuickButton({
  title,
  onPress,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, secondary && styles.actionButtonSecondary]}>
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

export function ClientHomeScreen({ navigation }: { navigation: any }) {
  const { data, loading, error } = useClientOverviewData();

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
        <EmptyState title="تعذر تحميل البوابة" message={error || 'لا توجد بيانات متاحة حالياً.'} />
      </Page>
    );
  }

  const featuredMatter = data.bootstrap.matters[0];

  return (
    <Page>
      <HeroCard
        eyebrow={`مرحباً ${data.bootstrap.client.name}`}
        title="بوابة العميل"
        subtitle="متابعة القضايا، المستندات، الفواتير، والعروض من نفس نظام المكتب وبواجهة أوضح لك."
        aside={<StatusChip label={`${data.bootstrap.counts.matters} قضايا`} tone="gold" />}
      />

      <View style={styles.stats}>
        <StatCard label="القضايا" value={String(data.bootstrap.counts.matters)} />
        <StatCard label="الفواتير" value={String(data.bootstrap.counts.invoices)} tone="gold" />
        <StatCard label="العروض" value={String(data.bootstrap.counts.quotes)} />
        <StatCard label="الرصيد المستحق" value={formatCurrency(data.bootstrap.counts.outstanding_balance)} tone="success" />
      </View>

      <Card>
        <SectionTitle title="إجراءات سريعة" subtitle="أهم ما قد تحتاجه الآن." />
        <View style={styles.actionRow}>
          <QuickButton title="قضاياي" onPress={() => navigation.navigate('ClientMatters')} />
          <QuickButton title="الخدمات" secondary onPress={() => navigation.navigate('ClientCenter')} />
        </View>
      </Card>

      {featuredMatter ? (
        <Pressable onPress={() => navigation.navigate('ClientMatterDetails', { matter: featuredMatter })}>
          <Card>
            <SectionTitle title="الخطوة القادمة" subtitle="آخر ملف يحتاج انتباهك أو يحتوي على تحديث." />
            <StatusChip label={featuredMatter.status} tone={statusTone(featuredMatter.status)} />
            <Text style={styles.title}>{featuredMatter.title}</Text>
            <Text style={styles.body}>{featuredMatter.summary || 'لا يوجد ملخص إضافي في الوقت الحالي.'}</Text>
            <Text style={styles.meta}>آخر تحديث: {formatDate(featuredMatter.updated_at)}</Text>
          </Card>
        </Pressable>
      ) : null}

      <Card>
        <SectionTitle title="آخر الإشعارات" subtitle="مستجدات القضايا والفواتير والمستندات." />
        {data.notifications.length ? (
          data.notifications.slice(0, 4).map((item) => (
            <SummaryRow
              key={item.id}
              title={item.title}
              subtitle={[item.body, formatDateTime(item.created_at)].filter(Boolean).join(' · ')}
              status={item.kind}
              tone={notificationTone(item.kind)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد إشعارات" message="ستظهر هنا آخر المستجدات القادمة من المكتب." />
        )}
      </Card>

      <Card>
        <SectionTitle title="الملخص المالي" subtitle="آخر الفواتير وعروض الأسعار." />
        {data.bootstrap.invoices.slice(0, 2).map((invoice) => (
          <SummaryRow
            key={invoice.id}
            title={`فاتورة ${invoice.number}`}
            subtitle={[
              invoice.matter_title || 'بدون قضية',
              `المتبقي ${formatCurrency(invoice.remaining_amount, invoice.currency || 'SAR')}`,
            ].join(' · ')}
            status={invoice.status}
            tone={statusTone(invoice.status)}
          />
        ))}
        {data.bootstrap.quotes.slice(0, 2).map((quote) => (
          <SummaryRow
            key={quote.id}
            title={`عرض ${quote.number}`}
            subtitle={[
              quote.matter_title || 'بدون قضية',
              formatCurrency(quote.total, quote.currency || 'SAR'),
            ].join(' · ')}
            status={quote.status}
            tone={statusTone(quote.status)}
          />
        ))}
        {!data.bootstrap.invoices.length && !data.bootstrap.quotes.length ? (
          <EmptyState title="لا توجد حركة مالية" message="لا توجد فواتير أو عروض أسعار مرتبطة بحسابك حالياً." />
        ) : null}
      </Card>
    </Page>
  );
}

export function ClientMattersScreen({ navigation }: { navigation: any }) {
  const { data, loading, error } = useClientOverviewData();
  const [query, setQuery] = useState('');

  const matters = data?.bootstrap.matters || [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return matters;
    return matters.filter((matter) =>
      `${matter.title} ${matter.summary || ''} ${matter.case_type || ''}`.toLowerCase().includes(normalized),
    );
  }, [matters, query]);

  return (
    <Page scroll={false}>
      <View style={styles.container}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في القضايا أو الملخص"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          textAlign="right"
        />

        {loading ? <LoadingBlock /> : null}
        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ClientMatterDetails', { matter: item })} style={styles.listItem}>
              <View style={styles.rowText}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                  {[item.case_type || 'ملف قانوني', `آخر تحديث ${formatDate(item.updated_at)}`].join(' · ')}
                </Text>
              </View>
              <StatusChip label={item.status} tone={statusTone(item.status)} />
            </Pressable>
          )}
          ListEmptyComponent={
            !loading ? <EmptyState title="لا توجد قضايا" message="لا توجد قضايا مرتبطة بحسابك حالياً." /> : null
          }
        />
      </View>
    </Page>
  );
}

export function ClientMatterDetailsScreen({ route }: ClientMatterDetailsProps) {
  const { session } = useAuth();
  const matter = route.params.matter;
  const [communications, setCommunications] = useState<ClientPortalMatterCommunication[]>(matter.communications);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSendQuestion() {
    if (!session?.token) return;

    const text = message.trim();
    if (text.length < 4) {
      setError('اكتب رسالة أو سؤالًا أوضح قبل الإرسال.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const payload = await submitClientPortalCommunication(session.token, {
        matterId: matter.id,
        message: text,
      });
      setCommunications((current) => [payload.communication, ...current]);
      setMessage('');
      Alert.alert('تم الإرسال', 'تم إرسال رسالتك إلى المكتب بنجاح.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إرسال الرسالة الآن.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Page>
      <HeroCard
        eyebrow="تفاصيل القضية"
        title={matter.title}
        subtitle={matter.summary || 'لا يوجد ملخص إضافي حالياً.'}
        aside={<StatusChip label={matter.status} tone={statusTone(matter.status)} />}
      />

      <Card>
        <SectionTitle title="آخر التحديثات" />
        {matter.events.length ? (
          matter.events.map((event) => (
            <SummaryRow
              key={event.id}
              title={event.type}
              subtitle={[event.note || 'بدون ملاحظة', formatDateTime(event.created_at)].join(' · ')}
              status={event.event_date ? formatDate(event.event_date) : undefined}
            />
          ))
        ) : (
          <EmptyState title="لا توجد تحديثات" message="سيظهر هنا كل تحديث جديد يرسله المكتب على هذه القضية." />
        )}
      </Card>

      <Card>
        <SectionTitle title="التواصل" subtitle="الرسائل الأساسية بينك وبين المكتب." />
        {communications.length ? (
          communications.map((item) => (
            <SummaryRow
              key={item.id}
              title={item.sender === 'CLIENT' ? 'أنت' : 'المكتب'}
              subtitle={[item.message, formatDateTime(item.created_at)].join(' · ')}
              status={item.sender === 'CLIENT' ? 'مرسلة' : 'واردة'}
              tone={item.sender === 'CLIENT' ? 'gold' : 'success'}
            />
          ))
        ) : (
          <EmptyState title="لا توجد رسائل" message="لم يتم تسجيل مراسلات أساسية على هذه القضية بعد." />
        )}

        <View style={styles.compose}>
          <Text style={styles.fieldLabel}>أرسل استفسارًا للمكتب</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="اكتب سؤالك أو التحديث الذي تريد إرساله"
            placeholderTextColor={colors.textMuted}
            style={[styles.search, styles.multilineInput]}
            multiline
            textAlign="right"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title={sending ? 'جارٍ الإرسال...' : 'إرسال الرسالة'} onPress={() => void handleSendQuestion()} disabled={sending} />
        </View>
      </Card>
    </Page>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  stats: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'right',
  },
  body: {
    color: colors.text,
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    lineHeight: 24,
    textAlign: 'right',
  },
  meta: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  list: {
    paddingBottom: 120,
    gap: spacing.md,
  },
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  logout: {
    marginTop: spacing.md,
    backgroundColor: colors.dangerSoft,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.danger,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: colors.surfaceMuted,
  },
  actionText: {
    color: '#fff7e2',
    fontFamily: fonts.arabicBold,
    fontSize: 14,
  },
  actionTextSecondary: {
    color: colors.primary,
  },
  linkButton: {
    color: colors.primarySoft,
    fontFamily: fonts.arabicBold,
    fontSize: 13,
  },
  linkGroup: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    color: colors.text,
    fontFamily: fonts.arabicMedium,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 104,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.arabicMedium,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  compose: {
    gap: spacing.md,
  },
  fieldLabel: {
    color: colors.text,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    textAlign: 'right',
  },
  formBlock: {
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  formTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    textAlign: 'right',
  },
  chipsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceChipSelected: {
    backgroundColor: colors.primary,
  },
  choiceChipText: {
    color: colors.primary,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
  },
  choiceChipTextSelected: {
    color: '#fff7e2',
  },
});
