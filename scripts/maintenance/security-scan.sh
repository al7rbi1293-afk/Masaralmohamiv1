#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${OUT_DIR:-./tmp/maintenance}"
mkdir -p "$OUT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
AUDIT_JSON="$OUT_DIR/npm-audit-$TS.json"
OUTDATED_JSON="$OUT_DIR/npm-outdated-$TS.json"
REPORT_TXT="$OUT_DIR/security-scan-$TS.txt"

echo "Running npm audit..."
npm audit --json > "$AUDIT_JSON" || true

echo "Running npm outdated..."
npm outdated --json > "$OUTDATED_JSON" || true

{
  echo "Security Scan Report"
  echo "Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo

  echo "[Dependency Vulnerabilities]"
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(j.metadata ? JSON.stringify(j.metadata.vulnerabilities,null,2) : 'No metadata');" "$AUDIT_JSON"
  echo

  echo "[Outdated Packages Count]"
  node -e "const fs=require('fs');const p=process.argv[1];const t=fs.readFileSync(p,'utf8').trim();if(!t){console.log(0);process.exit(0)};const j=JSON.parse(t);console.log(Object.keys(j).length);" "$OUTDATED_JSON"
  echo

  echo "[Potential Secret Leaks in Code]"
  rg -n -i '(api[_-]?key|secret|token|password)' apps --glob '!**/*.map' || true
  echo

  echo "[Raw console.* in Web/API]"
  rg -n 'console\\.(log|debug|info|warn|error)' apps/web apps/api || true
} | tee "$REPORT_TXT"

echo
echo "Reports:"
echo "- $AUDIT_JSON"
echo "- $OUTDATED_JSON"
echo "- $REPORT_TXT"
