# مسار المحامي | Masar Al-Muhami

Public marketing website for **مسار المحامي** built with Next.js App Router + TypeScript + Tailwind CSS (Arabic-first RTL).

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- `lucide-react` icons
- `next-themes` for light/dark toggle

## Pages

- `/` Landing
- `/security` Security & Privacy
- `/privacy` Privacy Policy
- `/terms` Terms & Conditions
- `/contact` Contact

## Run locally

From repository root:

```bash
npm install
npm run dev --workspace @masar/web
```

Open [http://localhost:3000](http://localhost:3000)

Alternative (full stack with Docker services):

```bash
docker compose up --build
```

## Build

```bash
npm run build --workspace @masar/web
npm run start --workspace @masar/web
```

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import project in Vercel.
3. Set **Root Directory** to `apps/web`.
4. Framework preset: **Next.js**.
5. Build command: `npm run build`.
6. Install command: `npm install`.
7. Deploy.

No environment variables are required for this marketing site.

## Optional static export

If you want static hosting only:

1. Update `apps/web/next.config.mjs`:

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

Exported files will be generated under `apps/web/out`.

## Notes

- Shared UI components are in `apps/web/components`.
- Site config, branding, and links are in `apps/web/lib/site.ts`.
- This repository still contains API/worker services from the broader Sijil stack, but the marketing website is isolated in `apps/web`.
