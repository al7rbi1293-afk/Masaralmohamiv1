import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, ModalShell } from './orgs-tab-ui';
import {
  DURATION_OPTIONS,
  PLAN_OPTIONS,
  type ActivationDurationMode,
  buildNextExpiryLabel,
  clampPositiveNumber,
  formatArabicDate,
  getCustomDurationLabel,
  getPlanLabel,
} from './orgs-tab-utils';
import type { ActivationDialogState, TrialDialogState } from './orgs-tab-types';

type ActivationDialogPanelProps = {
  activationDialog: ActivationDialogState;
  actionId: string | null;
  setActivationDialog: Dispatch<SetStateAction<ActivationDialogState | null>>;
  submitActivationDialog: () => void;
};

export function ActivationDialogPanel({
  activationDialog,
  actionId,
  setActivationDialog,
  submitActivationDialog,
}: ActivationDialogPanelProps) {
  return (
    <ModalShell
      title="تفعيل اشتراك"
      description={`تفعيل اشتراك للمكتب "${activationDialog.org.name}" مع تحديد الباقة والمدة.`}
      onClose={() => setActivationDialog(null)}
    >
      <div className="space-y-4">
        <FormField label="الباقة">
          <select
            value={activationDialog.plan}
            onChange={(event) =>
              setActivationDialog((current) =>
                current
                  ? {
                      ...current,
                      plan: event.target.value,
                    }
                  : current,
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="مدة التفعيل">
          <select
            value={activationDialog.durationMode}
            onChange={(event) =>
              setActivationDialog((current) =>
                current
                  ? {
                      ...current,
                      durationMode: event.target.value as ActivationDurationMode,
                      durationValue:
                        event.target.value === 'custom_years' || event.target.value === 'custom_months'
                          ? '1'
                          : current.durationValue,
                    }
                  : current,
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {activationDialog.org.has_admin_account && <option value="lifetime">مدى الحياة</option>}
          </select>
        </FormField>

        {(activationDialog.durationMode === 'custom_months' || activationDialog.durationMode === 'custom_years') && (
          <FormField label={getCustomDurationLabel(activationDialog.durationMode)}>
            <input
              type="number"
              min={1}
              max={activationDialog.durationMode === 'custom_years' ? 20 : 240}
              value={activationDialog.durationValue}
              onChange={(event) =>
                setActivationDialog((current) =>
                  current
                    ? {
                        ...current,
                        durationValue: event.target.value,
                      }
                    : current,
                )
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </FormField>
        )}

        <div className="rounded-xl border border-brand-emerald/20 bg-brand-emerald/5 p-4 text-sm text-slate-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-slate-200">
          <p className="font-semibold text-brand-navy dark:text-slate-100">ملخص التفعيل</p>
          <p className="mt-2">الباقة المختارة: {getPlanLabel(activationDialog.plan)}</p>
          <p className="mt-1">تاريخ الانتهاء المتوقع: {buildNextExpiryLabel(activationDialog.durationMode, activationDialog.durationValue)}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setActivationDialog(null)} disabled={actionId === activationDialog.org.id}>
          إلغاء
        </Button>
        <Button type="button" onClick={submitActivationDialog} disabled={actionId === activationDialog.org.id}>
          {actionId === activationDialog.org.id ? 'جارٍ التفعيل...' : 'تفعيل الاشتراك'}
        </Button>
      </div>
    </ModalShell>
  );
}

type TrialDialogPanelProps = {
  trialDialog: TrialDialogState;
  actionId: string | null;
  setTrialDialog: Dispatch<SetStateAction<TrialDialogState | null>>;
  submitTrialDialog: () => void;
};

export function TrialDialogPanel({
  trialDialog,
  actionId,
  setTrialDialog,
  submitTrialDialog,
}: TrialDialogPanelProps) {
  return (
    <ModalShell
      title="تمديد الفترة التجريبية"
      description={`تمديد تجربة المكتب "${trialDialog.org.name}" لعدد أيام تختاره.`}
      onClose={() => setTrialDialog(null)}
    >
      <div className="space-y-4">
        <FormField label="عدد الأيام">
          <input
            type="number"
            min={1}
            max={365}
            value={trialDialog.days}
            onChange={(event) =>
              setTrialDialog((current) =>
                current
                  ? {
                      ...current,
                      days: event.target.value,
                    }
                  : current,
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </FormField>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
          <p>النهاية الحالية: {formatArabicDate(trialDialog.org.trial?.ends_at)}</p>
          <p className="mt-1">عدد الأيام الجديدة: {clampPositiveNumber(trialDialog.days, 14, 365)} يوم</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setTrialDialog(null)} disabled={actionId === trialDialog.org.id}>
          إلغاء
        </Button>
        <Button type="button" onClick={submitTrialDialog} disabled={actionId === trialDialog.org.id}>
          {actionId === trialDialog.org.id ? 'جارٍ الحفظ...' : 'تمديد الفترة'}
        </Button>
      </div>
    </ModalShell>
  );
}
