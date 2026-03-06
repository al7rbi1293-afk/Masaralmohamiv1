#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://masaralmohamiproject-pied.vercel.app}"
DOMAIN="${DOMAIN:-masaralmohamiproject-pied.vercel.app}"
HEALTH_PATH="${HEALTH_PATH:-/api/health}"
OUT_DIR="${OUT_DIR:-./tmp/maintenance}"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/weekly-health-$(date +%F).txt"

check_url() {
  local url="$1"
  curl \
    --silent \
    --show-error \
    --connect-timeout 5 \
    --max-time 20 \
    --retry 2 \
    --retry-delay 1 \
    --retry-connrefused \
    --output /dev/null \
    --write-out "HTTP=%{http_code} TTFB=%{time_starttransfer}s TOTAL=%{time_total}s" \
    "$url"
}

dns_a_records() {
  dig +short A "$1" | tr '\n' ' '
}

cert_dates() {
  echo | openssl s_client -servername "$1" -connect "$1:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || true
}

{
  echo "Weekly Health Check"
  echo "Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "Base URL: $BASE_URL"
  echo "Domain: $DOMAIN"
  echo

  echo "[Reachability]"
  echo "Root: $(check_url "$BASE_URL")"
  echo "Health: $(check_url "$BASE_URL$HEALTH_PATH")"
  echo

  echo "[DNS]"
  echo "A Records: $(dns_a_records "$DOMAIN")"
  echo

  echo "[TLS Certificate]"
  cert_dates "$DOMAIN"
  echo

  echo "[Headers]"
  curl -sSI "$BASE_URL" | rg -i '^(HTTP/|server:|x-vercel-cache:|cache-control:|strict-transport-security:|content-security-policy:|x-frame-options:|x-content-type-options:|referrer-policy:|permissions-policy:)' || true
  echo

  echo "[Sitemap and Robots]"
  echo "robots.txt: $(check_url "$BASE_URL/robots.txt")"
  echo "sitemap.xml: $(check_url "$BASE_URL/sitemap.xml")"
} | tee "$OUT_FILE"

echo
echo "Saved: $OUT_FILE"
