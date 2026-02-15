# Masar Al-Muhami (مسار المحامي)

## Overview

Masar Al-Muhami is a comprehensive legal practice management platform designed for Saudi law firms. It includes:

- **Client Portal**: Marketing website (`/`) and contact forms.
- **App Platform**: Secure legal workspace (`/app`) for case management, tasks, and billing.
- **Admin Control Center**: Super-admin dashboard (`/admin`) for platform management.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS + Shadcn UI
- **Deployment**: Vercel

## Project Structure

- `apps/web`: Main Next.js application
- `apps/web/app/admin`: Admin Control Center routes
- `apps/web/app/app`: SaaS Platform routes
- `apps/web/lib`: Shared utilities and business logic
- `supabase/migrations`: Database schema definitions

## Getting Started

### 1. Prerequisites

- Node.js 18+
- Supabase Project

### 2. Environment Variables

Create `.env.local` in `apps/web`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Installation

```bash
npm install
```

### 4. Database Setup

Run migrations from `supabase/migrations` starting from `0001_init.sql` through `0028_admin_center.sql`.

### 5. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Admin Setup

To access the Admin Control Center (`/admin`), you must seed an admin user:

1. Sign up a new user via `/signup`.
2. Run the following SQL in Supabase:

```sql
INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com';
```

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Ensure all environment variables are set in the Vercel project settings.

## Documentation

- [HANDOVER.md](./HANDOVER.md): Detailed system architecture and handover notes.
- [SECURITY.md](./SECURITY.md): Security practices.
