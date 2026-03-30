import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  requestOfficeDocumentDownloadUrl,
} from '../features/office/api';
import {
  Card,
  EmptyState,
  HeroCard,
  LoadingBlock,
  Page,
  SectionTitle,
  SegmentedControl,
  StatCard,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  exportRemoteFileToDevice,
  openRemoteFileInApp,
} from '../lib/file-actions';
import {
  fetchOfficeMatterDetails,
  type MatterDetails,
} from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import type { OfficeStackParamList } from './office';
import { Meta, SummaryRow } from './office';
import { styles } from './office.styles';
import { matterTone } from './office.utils';

type OfficeMatterDetailsProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeMatterDetails'>;

export function OfficeMatterDetailsScreen({ route }: OfficeMatterDetailsProps) {
  const { session } = useAuth();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<MatterDetails | null>(null);
  const [section, setSection] = useState<'summary' | 'tasks' | 'documents' | 'timeline' | 'communications'>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function resolveMatterDocument(document: MatterDetails['documents'][number]) {
    if (!session?.token || !document.latest_version?.storage_path) {
      throw new Error('لا توجد نسخة قابلة للعرض لهذا المستند.');
    }

    const result = await requestOfficeDocumentDownloadUrl(
      { token: session.token, orgId: session.orgId },
      {
        document_id: document.id,
        storage_path: document.latest_version.storage_path,
      },
    );

    return {
      url: result.signedDownloadUrl,
      fileName: document.latest_version.file_name || `${document.title}.pdf`,
      mimeType: document.latest_version.mime_type,
    };
  }

  async function openMatterDocument(document: MatterDetails['documents'][number]) {
    const remote = await resolveMatterDocument(document);
    await openRemoteFileInApp(remote);
  }

  async function downloadMatterDocument(document: MatterDetails['documents'][number]) {
    const remote = await resolveMatterDocument(document);
    await exportRemoteFileToDevice(remote);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');

      try {
        const payload = await fetchOfficeMatterDetails(session.token, route.params.matterId);
        if (mounted) {
          setData(payload.data);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل تفاصيل القضية.');
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
  }, [route.params.matterId, session?.token]);

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
        <EmptyState title="تعذر تحميل القضية" message={error || 'قد لا تملك صلاحية الوصول إلى هذه القضية.'} />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow={data.client?.name || 'ملف قانوني'}
        title={data.title}
        subtitle={data.summary || 'لا يوجد ملخص مسجل حتى الآن.'}
        aside={<StatusChip label={data.status} tone={matterTone(data.status)} />}
      />

      <Card>
        <SectionTitle title="إجراءات الملف" subtitle="التعديلات السريعة على القضية من داخل الموبايل." />
        <View style={styles.quickActionsGrid}>
          <Pressable
            style={styles.actionTile}
            onPress={() =>
              navigation.navigate('OfficeMatterForm', {
                mode: 'edit',
                matter: {
                  id: data.id,
                  client_id: data.client_id,
                  title: data.title,
                  status: data.status,
                  summary: data.summary,
                  najiz_case_number: data.najiz_case_number,
                  case_type: data.case_type,
                  claims: data.claims,
                  is_private: data.is_private,
                },
              })
            }
          >
            <Text style={styles.actionTileTitle}>تعديل القضية</Text>
            <Text style={styles.actionTileMeta}>تحديث البيانات</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeTaskForm', { mode: 'create', task: { matter_id: data.id } })}>
            <Text style={styles.actionTileTitle}>مهمة جديدة</Text>
            <Text style={styles.actionTileMeta}>مرتبطة بالقضية</Text>
          </Pressable>
          <Pressable
            style={styles.actionTile}
            onPress={() => navigation.navigate('OfficeDocumentForm', { mode: 'create', draft: { matter_id: data.id, client_id: data.client_id || undefined, title: `${data.title} - مستند` } })}
          >
            <Text style={styles.actionTileTitle}>مستند جديد</Text>
            <Text style={styles.actionTileMeta}>رفع ملف</Text>
          </Pressable>
          {data.client ? (
            <Pressable
              style={styles.actionTile}
              onPress={() =>
                navigation.navigate('OfficeClientForm', {
                  mode: 'edit',
                  client: {
                    id: data.client?.id,
                    name: data.client?.name,
                    email: data.client?.email,
                    phone: data.client?.phone,
                  },
                })
              }
            >
              <Text style={styles.actionTileTitle}>تعديل العميل</Text>
              <Text style={styles.actionTileMeta}>ملف الموكل</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionTitle title="أقسام الملف" subtitle="بدل صفحة طويلة، انتقل مباشرة إلى القسم الذي تريد مراجعته." />
        <SegmentedControl
          value={section}
          onChange={(next) => setSection(next as typeof section)}
          options={[
            { key: 'summary', label: 'الملخص' },
            { key: 'tasks', label: 'المهام', count: data.tasks.length },
            { key: 'documents', label: 'المستندات', count: data.documents.length },
            { key: 'timeline', label: 'التسلسل', count: data.events.length },
            { key: 'communications', label: 'المراسلات', count: data.communications.length },
          ]}
        />
      </Card>

      {section === 'summary' ? (
        <Card>
          <SectionTitle title="معلومات أساسية" subtitle="نظرة سريعة على حالة الملف قبل الدخول للتفاصيل." />
          <View style={styles.statsGrid}>
            <StatCard label="المهام" value={String(data.tasks.length)} tone="warning" />
            <StatCard label="المستندات" value={String(data.documents.length)} tone="gold" />
            <StatCard label="الأحداث" value={String(data.events.length)} tone="success" />
            <StatCard label="المراسلات" value={String(data.communications.length)} />
          </View>
          <View style={styles.metaGrid}>
            <Meta label="نوع القضية" value={data.case_type || '—'} />
            <Meta label="رقم ناجز" value={data.najiz_case_number || '—'} />
            <Meta label="تاريخ الإنشاء" value={formatDate(data.created_at)} />
            <Meta label="آخر تحديث" value={formatDateTime(data.updated_at)} />
          </View>
          {data.claims ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>الطلبات</Text>
              <Text style={styles.body}>{data.claims}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {section === 'tasks' ? (
        <Card>
          <SectionTitle title="المهام المرتبطة" subtitle="حالة التنفيذ الحالية على هذا الملف." />
          {data.tasks.length ? (
            data.tasks.map((task) => (
              <SummaryRow
                key={task.id}
                title={task.title}
                subtitle={[
                  task.priority || 'بدون أولوية',
                  task.due_at ? `الاستحقاق ${formatDate(task.due_at)}` : 'بدون تاريخ',
                ].join(' · ')}
                status={task.status}
                tone={task.status === 'done' ? 'success' : task.priority === 'high' ? 'warning' : 'default'}
              />
            ))
          ) : (
            <EmptyState title="لا توجد مهام" message="لا توجد مهام مرتبطة بهذه القضية حاليًا." />
          )}
        </Card>
      ) : null}

      {section === 'documents' ? (
        <Card>
          <SectionTitle title="المستندات" subtitle="آخر النسخ المرفوعة أو المعتمدة في الملف." />
          {data.documents.length ? (
            data.documents.map((document) => (
              <View key={document.id} style={styles.controlRow}>
                <View style={styles.controlRowMain}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{document.title}</Text>
                    <Text style={styles.rowMeta}>
                      {[
                        document.latest_version?.file_name || 'بدون نسخة',
                        document.latest_version?.created_at
                          ? formatDate(document.latest_version.created_at)
                          : formatDate(document.created_at),
                      ].join(' · ')}
                    </Text>
                  </View>
                  <StatusChip
                    label={document.latest_version ? `v${document.latest_version.version_no}` : 'بدون نسخة'}
                    tone="gold"
                  />
                </View>
                <View style={styles.inlineActionRow}>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      try {
                        await openMatterDocument(document);
                      } catch (nextError) {
                        setError(nextError instanceof Error ? nextError.message : 'تعذر فتح المستند.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>عرض</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      try {
                        await downloadMatterDocument(document);
                        setError('');
                      } catch (nextError) {
                        setError(nextError instanceof Error ? nextError.message : 'تعذر تنزيل المستند.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>تحميل</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title="لا توجد مستندات" message="سيظهر هنا كل مستند مرتبط بهذه القضية." />
          )}
        </Card>
      ) : null}

      {section === 'timeline' ? (
        <Card>
          <SectionTitle title="الخط الزمني" subtitle="آخر الأحداث والتحديثات على الملف." />
          {data.events.length ? (
            data.events.map((item) => (
              <View key={item.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineText}>
                  <Text style={styles.rowTitle}>{item.type}</Text>
                  <Text style={styles.rowMeta}>
                    {[formatDateTime(item.created_at), item.created_by_name || '—'].join(' · ')}
                  </Text>
                  {item.note ? <Text style={styles.body}>{item.note}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <EmptyState title="لا توجد أحداث" message="لم يتم تسجيل أي أحداث على هذه القضية بعد." />
          )}
        </Card>
      ) : null}

      {section === 'communications' ? (
        <Card>
          <SectionTitle title="التواصل" subtitle="آخر الرسائل والمراسلات المسجلة." />
          {data.communications.length ? (
            data.communications.map((item) => (
              <SummaryRow
                key={item.id}
                title={item.sender === 'CLIENT' ? 'العميل' : 'الفريق'}
                subtitle={[item.message, formatDateTime(item.created_at)].join(' · ')}
                status={item.sender}
                tone={item.sender === 'CLIENT' ? 'gold' : 'success'}
              />
            ))
          ) : (
            <EmptyState title="لا توجد مراسلات" message="لم يتم تسجيل مراسلات أساسية على هذا الملف بعد." />
          )}
        </Card>
      ) : null}
    </Page>
  );
}
