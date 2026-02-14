import 'server-only';

// Single source of truth for the app version (server-side).
// Priority:
// 1) APP_VERSION (manual release tag)
// 2) VERCEL_GIT_COMMIT_SHA (set by Vercel)
// 3) npm_package_version (available during build)
// 4) fallback "dev"
export function getAppVersion() {
  return (
    process.env.APP_VERSION?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.npm_package_version?.trim() ||
    'dev'
  );
}

