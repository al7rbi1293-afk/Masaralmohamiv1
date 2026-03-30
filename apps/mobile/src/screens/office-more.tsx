import { useIsFocused, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import {
  addOfficeDocumentVersion,
  archiveOfficeDocument,
  archiveOfficeInvoice,
  archiveOfficeTask,
  fetchOfficeBilling,
  fetchOfficeDocuments,
  fetchOfficeInvoiceDetails,
  fetchOfficeNotifications,
  fetchOfficeQuoteDetails,
  fetchOfficeTasks,
  setOfficeTaskStatus,
  type OfficeBillingResponse,
  type OfficeDocument,
  type OfficeNotification,
  type OfficeTask,
} from '../features/office/api';
import {
  HeroCard,
  LoadingBlock,
  Page,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  downloadOfficeBillingPdfToDevice,
  downloadOfficeDocumentToDevice,
  openOfficeBillingPdfInApp,
  openOfficeDocumentInApp,
  sendOfficeBillingInvoiceEmail,
  shareOfficeBillingPdfFromDevice,
  shareOfficeDocumentFromDevice,
} from './office-more-actions';
import {
  OfficeMoreActivitySection,
  OfficeMoreBillingSection,
  type OfficeBillingPreview,
  OfficeMoreDocumentsSection,
  OfficeMoreTasksSection,
  toTaskWritePayload,
} from './office-more-sections';
import { openPrivacyPolicy, openSupportPage, openTermsOfService } from '../lib/legal-links';
import { requestSignedInAccountDeletion } from '../lib/api';
import {
  OfficeMoreAccountCard,
  OfficeMoreQuickActionsCard,
  OfficeMoreSectionControlCard,
  OfficeMoreSettingsShortcutsCard,
} from './office-more-layout';
import { styles } from './office.styles';
import { officeRoleLabel } from './office.utils';

export function OfficeMoreScreen() {
  const { session, signOut, switchPortal } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  const [tasks, setTasks] = useState<OfficeTask[]>([]);
  const [documents, setDocuments] = useState<OfficeDocument[]>([]);
  const [billing, setBilling] = useState<OfficeBillingResponse | null>(null);
  const [notifications, setNotifications] = useState<OfficeNotification[]>([]);

  const [section, setSection] = useState<'tasks' | 'documents' | 'billing' | 'activity'>('tasks');
  const [billingPreview, setBillingPreview] = useState<OfficeBillingPreview>(null);
  const [billingPreviewLoading, setBillingPreviewLoading] = useState(false);

  const [invoiceEmailTo, setInvoiceEmailTo] = useState('');
  const [invoiceEmailMessage, setInvoiceEmailMessage] = useState('');
  const [invoiceEmailSending, setInvoiceEmailSending] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    if (billingPreview?.kind === 'invoice') {
      setInvoiceEmailTo(billingPreview.invoice.client?.email || '');
      setInvoiceEmailMessage('');
      return;
    }

    setInvoiceEmailTo('');
    setInvoiceEmailMessage('');
  }, [billingPreview]);

  async function handleSendInvoiceEmail() {
    if (!session?.token || billingPreview?.kind !== 'invoice') {
      return;
    }

    setInvoiceEmailSending(true);
    setActionMessage('');

    try {
      const response = await sendOfficeBillingInvoiceEmail(
        { token: session.token, orgId: session.orgId },
        {
          invoice_id: billingPreview.invoice.id,
          to_email: invoiceEmailTo.trim() || undefined,
          message_optional: invoiceEmailMessage.trim() || undefined,
        },
      );
      setInvoiceEmailTo(response.to_email);
      setActionMessage(`تم إرسال الفاتورة ${billingPreview.invoice.number} إلى ${response.to_email}`);
    } catch (nextError) {
      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر إرسال الفاتورة بالبريد.');
    } finally {
      setInvoiceEmailSending(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');

      try {
        const [tasksRes, documentsRes, billingRes, notificationsRes] = await Promise.all([
          fetchOfficeTasks(session.token, { page: 1, limit: 6, mine: 1 }),
          fetchOfficeDocuments(session.token, { page: 1, limit: 6 }),
          fetchOfficeBilling(session.token, { page: 1, limit: 6 }),
          fetchOfficeNotifications(session.token, { page: 1, limit: 6 }),
        ]);

        if (mounted) {
          setTasks(tasksRes.data);
          setDocuments(documentsRes.data);
          setBilling(billingRes);
          setNotifications(notificationsRes.data);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل الوحدات الإضافية.');
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
  }, [isFocused, session?.token]);

  if (loading) {
    return (
      <Page>
        <LoadingBlock />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow="مركز العمليات"
        title="الوحدات التشغيلية"
        subtitle="العمل الآن مقسّم إلى شرائح أصغر: المهام، المستندات، الفوترة، والنشاط."
        aside={<StatusChip label="مربوط بالموقع" tone="success" />}
      />

      <OfficeMoreQuickActionsCard
        actionMessage={actionMessage}
        onNewTask={() => navigation.navigate('OfficeTaskForm', { mode: 'create' })}
        onNewDocument={() => navigation.navigate('OfficeDocumentForm', { mode: 'create' })}
        onNewClient={() => navigation.navigate('OfficeClientForm', { mode: 'create' })}
        onNewMatter={() => navigation.navigate('OfficeMatterForm', { mode: 'create' })}
        onNewQuote={() => navigation.navigate('OfficeBillingForm', { mode: 'quote' })}
        onNewInvoice={() => navigation.navigate('OfficeBillingForm', { mode: 'invoice' })}
        onOpenSettingsHome={() => navigation.navigate('OfficeSettingsHome')}
      />

      <OfficeMoreSettingsShortcutsCard
        onIdentity={() => navigation.navigate('OfficeSettings', { section: 'identity' })}
        onTeam={() => navigation.navigate('OfficeSettings', { section: 'team' })}
        onSubscription={() => navigation.navigate('OfficeSettings', { section: 'subscription' })}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <OfficeMoreSectionControlCard
        section={section}
        counts={{
          tasks: tasks.length,
          documents: documents.length,
          billing: (billing?.invoices.data.length || 0) + (billing?.quotes.data.length || 0),
          activity: notifications.length,
        }}
        onSectionChange={(nextSection) => {
          setSection(nextSection);
          if (nextSection !== 'billing') {
            setBillingPreview(null);
          }
        }}
      />

      {section === 'tasks' ? (
        <OfficeMoreTasksSection
          tasks={tasks}
          onOpenTask={(task) =>
            navigation.navigate('OfficeTaskForm', {
              mode: 'edit',
              task: toTaskWritePayload(task),
            })
          }
          onMarkDone={(task) => {
            if (!session?.token) return;
            void setOfficeTaskStatus({ token: session.token, orgId: session.orgId }, { id: task.id, status: 'done' })
              .then(() => {
                setTasks((current) =>
                  current.map((item) => (item.id === task.id ? { ...item, status: 'done', is_overdue: false } : item)),
                );
                setActionMessage(`تم إغلاق المهمة: ${task.title}`);
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تحديث المهمة.');
              });
          }}
          onArchiveTask={(task) => {
            if (!session?.token) return;
            void archiveOfficeTask({ token: session.token, orgId: session.orgId }, { id: task.id, archived: true })
              .then(() => {
                setTasks((current) => current.filter((item) => item.id !== task.id));
                setActionMessage(`تمت أرشفة المهمة: ${task.title}`);
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر أرشفة المهمة.');
              });
          }}
        />
      ) : null}

      {section === 'documents' ? (
        <OfficeMoreDocumentsSection
          documents={documents}
          onViewDocument={(document) => {
            if (!session?.token) return;
            void openOfficeDocumentInApp({ token: session.token, orgId: session.orgId }, document)
              .then(() => {
                setActionMessage(`تم فتح المستند: ${document.title}`);
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح المستند.');
              });
          }}
          onDownloadDocument={(document) => {
            if (!session?.token) return;
            void downloadOfficeDocumentToDevice({ token: session.token, orgId: session.orgId }, document)
              .then(() => {
                setActionMessage(`تم تجهيز تنزيل المستند: ${document.title}`);
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تنزيل المستند.');
              });
          }}
          onShareDocument={(document) => {
            if (!session?.token) return;
            void shareOfficeDocumentFromDevice({ token: session.token, orgId: session.orgId }, document)
              .then(() => {
                setActionMessage(`تمت مشاركة المستند: ${document.title}`);
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر مشاركة المستند.');
              });
          }}
          onAddDocumentVersion={(document) => {
            if (!session?.token) return;
            void DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false })
              .then((picked) => {
                if (picked.canceled) return;
                const asset = picked.assets[0];
                return addOfficeDocumentVersion(
                  { token: session.token!, orgId: session.orgId },
                  {
                    document_id: document.id,
                    file: {
                      uri: asset.uri,
                      name: asset.name,
                      mimeType: asset.mimeType ?? null,
                    },
                  },
                );
              })
              .then((result) => {
                if (!result) return;
                setActionMessage(`تمت إضافة نسخة جديدة إلى: ${document.title}`);
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر رفع النسخة الجديدة.');
              });
          }}
          onToggleDocumentArchive={(document) => {
            if (!session?.token) return;
            void archiveOfficeDocument(
              { token: session.token, orgId: session.orgId },
              { id: document.id, archived: !document.is_archived },
            )
              .then(() => {
                setDocuments((current) =>
                  current.map((item) => (item.id === document.id ? { ...item, is_archived: !item.is_archived } : item)),
                );
                setActionMessage(
                  document.is_archived
                    ? `تم استرجاع المستند: ${document.title}`
                    : `تمت أرشفة المستند: ${document.title}`,
                );
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تحديث المستند.');
              });
          }}
        />
      ) : null}

      {section === 'billing' ? (
        <OfficeMoreBillingSection
          billing={billing}
          billingPreview={billingPreview}
          billingPreviewLoading={billingPreviewLoading}
          invoiceEmailTo={invoiceEmailTo}
          invoiceEmailMessage={invoiceEmailMessage}
          invoiceEmailSending={invoiceEmailSending}
          onOpenInvoice={(invoice) => {
            if (!session?.token) return;
            setBillingPreviewLoading(true);
            void fetchOfficeInvoiceDetails({ token: session.token, orgId: session.orgId }, invoice.id)
              .then((details) => {
                setBillingPreview({ kind: 'invoice', invoice: details.invoice, payments: details.payments });
                setActionMessage(`تم فتح الفاتورة ${invoice.number}`);
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح الفاتورة.');
              })
              .finally(() => {
                setBillingPreviewLoading(false);
              });
          }}
          onOpenQuote={(quote) => {
            if (!session?.token) return;
            setBillingPreviewLoading(true);
            void fetchOfficeQuoteDetails({ token: session.token, orgId: session.orgId }, quote.id)
              .then((details) => {
                setBillingPreview({ kind: 'quote', quote: details.quote });
                setActionMessage(`تم فتح عرض السعر ${quote.number}`);
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح عرض السعر.');
              })
              .finally(() => {
                setBillingPreviewLoading(false);
              });
          }}
          onToggleInvoiceArchive={(invoice) => {
            if (!session?.token) return;
            const nextArchived = !(invoice.is_archived ?? false);
            void archiveOfficeInvoice(
              { token: session.token, orgId: session.orgId },
              { id: invoice.id, archived: nextArchived },
            )
              .then((updated) => {
                setBilling((current) =>
                  current
                    ? {
                        ...current,
                        invoices: {
                          ...current.invoices,
                          data: current.invoices.data.map((item) => (item.id === invoice.id ? updated : item)),
                        },
                      }
                    : current,
                );
                setActionMessage(
                  nextArchived ? `تمت أرشفة الفاتورة ${invoice.number}` : `تم استرجاع الفاتورة ${invoice.number}`,
                );
              })
              .catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تحديث حالة الفاتورة.');
              });
          }}
          onViewBillingPdf={(kind, id, number) => {
            if (!session?.token) return;
            void openOfficeBillingPdfInApp({ token: session.token, orgId: session.orgId }, kind, id, number).catch((nextError) => {
              setActionMessage(
                nextError instanceof Error
                  ? nextError.message
                  : kind === 'invoice'
                    ? 'تعذر فتح PDF الفاتورة.'
                    : 'تعذر فتح PDF العرض.',
              );
            });
          }}
          onDownloadBillingPdf={(kind, id, number) => {
            if (!session?.token) return;
            void downloadOfficeBillingPdfToDevice({ token: session.token, orgId: session.orgId }, kind, id, number)
              .then(() => {
                setActionMessage(
                  kind === 'invoice'
                    ? `تم تجهيز تنزيل الفاتورة ${number}`
                    : `تم تجهيز تنزيل عرض السعر ${number}`,
                );
              })
              .catch((nextError) => {
                setActionMessage(
                  nextError instanceof Error
                    ? nextError.message
                    : kind === 'invoice'
                      ? 'تعذر تنزيل الفاتورة.'
                      : 'تعذر تنزيل عرض السعر.',
                );
              });
          }}
          onShareBillingPdf={(kind, id, number) => {
            if (!session?.token) return;
            void shareOfficeBillingPdfFromDevice({ token: session.token, orgId: session.orgId }, kind, id, number).catch((nextError) => {
              setActionMessage(
                nextError instanceof Error
                  ? nextError.message
                  : kind === 'invoice'
                    ? 'تعذر مشاركة الفاتورة.'
                    : 'تعذر مشاركة عرض السعر.',
              );
            });
          }}
          onInvoiceEmailToChange={setInvoiceEmailTo}
          onInvoiceEmailMessageChange={setInvoiceEmailMessage}
          onSendInvoiceEmail={() => {
            void handleSendInvoiceEmail();
          }}
        />
      ) : null}

      {section === 'activity' ? <OfficeMoreActivitySection notifications={notifications} /> : null}

      <OfficeMoreAccountCard
        email={session?.email || '—'}
        roleLabel={officeRoleLabel(session?.role || null)}
        isAdmin={Boolean(session?.isAdmin)}
        deleteButtonTitle={session?.role === 'owner' ? 'طلب حذف الحساب والبيانات' : 'طلب حذف الحساب'}
        onSwitchAdmin={() => {
          void switchPortal('admin').catch((nextError) => {
            setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح لوحة الإدارة.');
          });
        }}
        onSignOut={() => {
          void signOut();
        }}
        onOpenSupport={() => {
          void openSupportPage();
        }}
        onOpenTerms={() => {
          void openTermsOfService();
        }}
        onOpenPrivacy={() => {
          void openPrivacyPolicy();
        }}
        onRequestDelete={() => {
          if (!session?.token) return;
          void requestSignedInAccountDeletion(session.token)
            .then((response) => {
              setActionMessage(response.message || 'تم إرسال طلب حذف الحساب.');
            })
            .catch((nextError) => {
              setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر إرسال الطلب.');
            });
        }}
      />
    </Page>
  );
}
