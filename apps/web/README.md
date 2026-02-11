# Masar Al-Muhami Web App

واجهة Next.js تشمل:

- الموقع التسويقي
- إنشاء حساب مكتب جديد (Signup)
- بوابة إدارة المكتب (Portal)

## Routes

### Marketing
- `/`
- `/security`
- `/privacy`
- `/terms`
- `/contact`

### Workspace
- `/start`
- `/app/login`
- `/app/{tenantId}/dashboard`
- `/app/{tenantId}/clients`
- `/app/{tenantId}/matters`
- `/app/{tenantId}/documents`
- `/app/{tenantId}/tasks`
- `/app/{tenantId}/billing`
- `/app/{tenantId}/settings`
- `/app/{tenantId}/users`

## Local run

From monorepo root:

```bash
npm install
npm run dev --workspace @masar/web
```

## Build

```bash
npm run build --workspace @masar/web
npm run start --workspace @masar/web
```

## Environment

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Deploy to Vercel

1. Import repo in Vercel.
2. Set root directory to `apps/web`.
3. Add env var:
   - `NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN`
4. Deploy.
