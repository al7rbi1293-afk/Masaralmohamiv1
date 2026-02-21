const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all files that use checkRateLimit
const files = execSync('grep -rl "checkRateLimit" . --exclude-dir=node_modules --exclude-dir=.next --exclude="rateLimit.ts" --exclude="update_ratelimit.js"').toString().split('\n').filter(Boolean);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Replace direct calls to checkRateLimit with await
  // Watch out for cases where it's already awaited, or assigned to a variable
  content = content.replace(/([^a-zA-Z0-9_])checkRateLimit\(/g, (match, p1) => {
    if (content.substring(Math.max(0, content.indexOf(match) - 6)).includes('await ')) {
       // rough heuristic, better: just replace if checking for await directly before
    }
    return p1 + 'await checkRateLimit(';
  });
  
  // Clean up double awaits if they happened
  content = content.replace(/await\s+await\s+checkRateLimit/g, 'await checkRateLimit');

  if (original !== content) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
