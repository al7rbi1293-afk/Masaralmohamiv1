export function withTenant<T extends Record<string, unknown>>(
  tenantId: string,
  where: T = {} as T,
): T & { tenantId: string } {
  return {
    tenantId,
    ...where,
  };
}
