import 'server-only';

import type { IntegrationAccount } from '../domain/models';
import { NajizProvider } from './najiz/provider';

export function getIntegrationProvider(account: IntegrationAccount) {
  switch (account.provider) {
    case 'najiz':
    default:
      return new NajizProvider();
  }
}
