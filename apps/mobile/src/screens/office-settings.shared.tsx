import { Pressable, Text, View } from 'react-native';
import type { StoredSession } from '../lib/session';
import type { OfficeTeamMember } from '../features/office/api';
import { styles } from './office-settings.styles';

export const permissionOptions = [
  { key: 'matters', label: 'القضايا' },
  { key: 'clients', label: 'العملاء' },
  { key: 'billing', label: 'الفوترة' },
  { key: 'settings', label: 'الإعدادات' },
] as const;

export const roleOptions: Array<{ key: OfficeTeamMember['role']; label: string }> = [
  { key: 'owner', label: 'مالك' },
  { key: 'lawyer', label: 'محامٍ' },
  { key: 'assistant', label: 'مساعد' },
];

export function roleLabel(value: string | null | undefined) {
  switch (String(value ?? '').toLowerCase()) {
    case 'owner':
      return 'مالك';
    case 'lawyer':
      return 'محامٍ';
    case 'assistant':
      return 'مساعد';
    default:
      return value || '—';
  }
}

export function requestStatusLabel(value: string | null | undefined) {
  switch (String(value ?? '').toLowerCase()) {
    case 'pending':
      return 'قيد المراجعة';
    case 'approved':
      return 'مقبول';
    case 'rejected':
      return 'مرفوض';
    case 'active':
      return 'نشط';
    case 'trial':
      return 'تجريبي';
    case 'expired':
      return 'منتهي';
    default:
      return value || '—';
  }
}

export function requestTone(value: string | null | undefined): 'default' | 'success' | 'warning' | 'danger' | 'gold' {
  switch (String(value ?? '').toLowerCase()) {
    case 'approved':
    case 'active':
      return 'success';
    case 'pending':
    case 'trial':
      return 'warning';
    case 'rejected':
    case 'expired':
      return 'danger';
    default:
      return 'gold';
  }
}

export function ensureOfficeSession(session: StoredSession | null) {
  if (!session || session.kind !== 'office') {
    throw new Error('يجب تسجيل الدخول بحساب المكتب أولاً.');
  }

  if (session.portal !== 'office') {
    throw new Error('هذه الشاشة متاحة من بوابة المكتب فقط.');
  }

  return {
    token: session.token,
    orgId: session.orgId,
    role: session.role,
  };
}

export function PermissionToggleGroup({
  value,
  onToggle,
}: {
  value: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <View style={styles.permissionsRow}>
      {permissionOptions.map((permission) => {
        const active = Boolean(value[permission.key]);
        return (
          <Pressable
            key={permission.key}
            onPress={() => onToggle(permission.key)}
            style={[styles.permissionChip, active && styles.permissionChipActive]}
          >
            <Text style={[styles.permissionChipText, active && styles.permissionChipTextActive]}>
              {permission.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
