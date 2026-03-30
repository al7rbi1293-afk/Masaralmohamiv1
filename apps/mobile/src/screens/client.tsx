import type { ClientPortalMatter } from '../features/client/types';

export type ClientStackParamList = {
  ClientTabs: undefined;
  ClientMatterDetails: {
    matter: ClientPortalMatter;
  };
};

export { ClientHomeScreen } from './client-home';
export { ClientMattersScreen } from './client-matters';
export { ClientMatterDetailsScreen } from './client-matter-details';
export {
  statusTone,
  notificationTone,
  requestSourceLabel,
  useClientOverviewData,
  SummaryRow,
  QuickButton,
  styles,
} from './client-shared';
