# Project Handover Document

**Project**: Masar Al-Muhami (Legal Practice Management Platform)
**Version**: 1.0.0 (Step 13 Complete)
**Date**: Feb 15, 2026

---

## 🏗️ System Architecture

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS, Shadcn UI, Lucid React Icons.
- **State Management**: React Server Components (RSC) for data fetching, Client Components for interactivity.
- **Admin Panel**: Protected route at `/admin` with separate layout and auth guards.

### Backend

- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS).
- **Authentication**: Supabase Auth (Email/Password + OAuth).
- **API**: Next.js Route Handlers (`/app/api/*`).
- **Migrations**: SQL files in `supabase/migrations`.

### Key Integrations

- **Email**: Microsoft Graph API for sending/syncing emails.
- **Calendar**: Internal calendar system with ICS feed export.
- **Documents**: `docx` and `pdf-lib` for generating legal documents from templates.
- **Analytics**: Google Analytics 4 + Meta Pixel.

---

## 🔐 Environment Variables

Ensure these are set in your production environment (Vercel):

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key for client-side requests. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** key for admin tasks (User management, cron jobs). |
| `NEXT_PUBLIC_SITE_URL` | The production URL (e.g., `https://masaralmohamiproject-pied.vercel.app`). |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 Measurement ID. |
| `NEXT_PUBLIC_FB_PIXEL_ID` | Meta Pixel ID. |
| `AZURE_AD_CLIENT_ID` | Microsoft App Client ID (for Email). |
| `AZURE_AD_CLIENT_SECRET` | Microsoft App Secret. |
| `AZURE_AD_TENANT_ID` | Microsoft Tenant ID. |

---

## 🗄️ Database Schema Summary

Key tables and their purpose:

- **`profiles`**: User metadata (full name, phone, status).
- **`organizations`**: Tenant/Firm data.
- **`org_members`**: Link between users and organizations (roles: owner, admin, member).
- **`leads`**: Landing page leads.
- **`matters`**: Legal cases/files.
- **`tasks`**: Task management linked to matters.
- **`calendar_events`**: Appointments and court dates.
- **`documents`**: Generated or uploaded files.
- **`templates`**: Document templates with placeholders.
- **`app_admins`**: Super-admin users (defines access to `/admin`).
- **`audit_logs`**: System-wide audit trail for admin actions.

---

## 🚀 Deployment & Maintenance

### Deploying Updates

The project is configured for Vercel. Pushing to the `main` branch automatically triggers a deployment.

```bash
git push origin main
```

### Checking Logs

- **Vercel**: Visit the deployment dashboard for build and runtime logs.
- **Supabase**: Check database logs for slow queries or errors.

### Database Migrations

Always apply migrations sequentially. New features should add a new SQL file (e.g., `0029_feature_name.sql`).

---

## 🔮 Future Roadmap (Suggested)

1. **Orchestrations (Zapier/Make)**: Add webhooks for external automation.
2. **Advanced Billing**: Stripe integration for automated subscription billing.
3. **Client Portal**: Allow clients to log in and view their case status securely.
4. **AI Integration**: Analyze legal documents and suggest improvements.

---

## ✅ Final Verification

- [x] Admin Panel redirect fix deployed.
- [x] All migrations applied.
- [x] Production build confirmed stable.

**Handover Complete.** 🚀
