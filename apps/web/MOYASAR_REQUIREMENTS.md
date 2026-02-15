# Moyasar Integration Requirements

To enable automated payments (Visa, Mada, Apple Pay) instead of manual bank transfers, we will need to integrate **Moyasar**.

## 1. Required Keys

If you have created a Moyasar account, please go to your **Dashboard > Settings > API Keys** and provide:

1. **Publishable Key** (starts with `pk_test_` or `pk_live_`)
2. **Secret Key** (starts with `sk_test_` or `sk_live_`)

## 2. Webhook Setup

We will also need to configure a **Webhook** in Moyasar to notify our system when a payment is successful.

- **URL**: `https://your-domain.com/api/webhooks/moyasar` (We will build this route later).

## 3. Apple Pay

For Apple Pay, you will need to verify your domain in Moyasar dashboard by downloading a file and uploading it to your website (we can help with this).

*For now, the system uses "Manual Bank Transfer" which works without these keys.*
