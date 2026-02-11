# Masar Al-Muhami Marketing Website

Public marketing site for **مسار المحامي** built with:

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Arabic-first RTL layout (`lang="ar"` + `dir="rtl"`)

## Routes

- `/` الرئيسية
- `/security` الأمان والخصوصية
- `/privacy` سياسة الخصوصية
- `/terms` الشروط والأحكام
- `/contact` تواصل معنا

## Run locally

From monorepo root:

```bash
npm install
npm run dev --workspace @masar/web
```

Open: [http://localhost:3000](http://localhost:3000)

## Production build

From monorepo root:

```bash
npm run build --workspace @masar/web
npm run start --workspace @masar/web
```

## Deploy to Vercel

1. Push repository to GitHub.
2. In Vercel, import the repo.
3. Set **Root Directory** to `apps/web`.
4. Framework preset: **Next.js**.
5. Build command: `npm run build`.
6. Output directory: leave default.
7. Deploy.

No required environment variables for this marketing site.

## Optional static export

If you want a fully static build:

1. Update `apps/web/next.config.mjs` with:

```js
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
```

2. Build:

```bash
npm run build --workspace @masar/web
```

Static files will be generated in `apps/web/out`.
