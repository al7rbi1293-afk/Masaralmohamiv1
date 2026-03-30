import { Text, View } from 'react-native';
import { StatusChip } from '../components/ui';
import {
  type OfficeBillingItem,
  type OfficeClientWritePayload,
  type OfficeDocumentWritePayload,
  type OfficeMatterWritePayload,
  type OfficeTaskWritePayload,
} from '../features/office/api';
import { styles } from './office.styles';

export type OfficeStackParamList = {
  OfficeTabs: undefined;
  OfficeMatterDetails: { matterId: string; title: string };
  OfficeClientForm: { mode: 'create' | 'edit'; client?: Partial<OfficeClientWritePayload> & { id?: string } };
  OfficeMatterForm: { mode: 'create' | 'edit'; matter?: Partial<OfficeMatterWritePayload> & { id?: string } };
  OfficeTaskForm: { mode: 'create' | 'edit'; task?: Partial<OfficeTaskWritePayload> & { id?: string } };
  OfficeDocumentForm: { mode: 'create'; draft?: Partial<OfficeDocumentWritePayload> };
  OfficeSettingsHome: undefined;
  OfficeIdentitySettings: undefined;
  OfficeTeamSettings: undefined;
  OfficeSubscriptionSettings: undefined;
  OfficeBillingForm: {
    mode: 'quote' | 'invoice';
    draft?: {
      client_id?: string | null;
      matter_id?: string | null;
      items?: OfficeBillingItem[];
    };
  };
  OfficeSettings: { section?: 'identity' | 'team' | 'subscription' } | undefined;
};

export function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export function SummaryRow({
  title,
  subtitle,
  status,
  tone = 'default',
}: {
  title: string;
  subtitle: string;
  status?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{subtitle}</Text>
      </View>
      {status ? <StatusChip label={status} tone={tone} /> : null}
    </View>
  );
}

export { OfficeHomeScreen } from './office-home';
export { OfficeCalendarScreen } from './office-calendar';
export { OfficeClientsScreen } from './office-clients';
export { OfficeMattersScreen } from './office-matters';

export {
  OfficeBillingFormScreen,
  OfficeClientFormScreen,
  OfficeDocumentFormScreen,
  OfficeMatterFormScreen,
  OfficeTaskFormScreen,
} from './office-forms';
