import 'server-only';

import Stripe from 'stripe';
import { getStripeSecretKey } from '@/lib/env';

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (stripeClient) return stripeClient;
  stripeClient = new Stripe(getStripeSecretKey());
  return stripeClient;
}
