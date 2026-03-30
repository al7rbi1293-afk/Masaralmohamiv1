import { type ApplicationStatusFilter, type PartnerApplication } from './partners-tab-types';

export function applyApplicationResult(
  current: PartnerApplication[],
  result: { applicationId?: string; status?: PartnerApplication['status'] | 'deleted' } | undefined,
  currentFilter: ApplicationStatusFilter,
  fallbackId: string,
  notes?: string,
) {
  const applicationId = String(result?.applicationId || fallbackId);
  const nextStatus = result?.status;

  if (!nextStatus) {
    return current;
  }

  if (nextStatus === 'deleted') {
    return current.filter((application) => application.id !== applicationId);
  }

  const nextRows = current.map((application) => (
    application.id === applicationId
      ? {
          ...application,
          status: nextStatus,
          admin_notes: notes ?? application.admin_notes,
        }
      : application
  ));

  if (currentFilter !== 'all' && currentFilter !== nextStatus) {
    return nextRows.filter((application) => application.id !== applicationId);
  }

  return nextRows;
}
