const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

// Replace evalExpr call sites that have 3 arguments to have 4
const modified = code.replace(/evalExpr\s*\(([^,]+),\s*([^,]+),\s*([^,)]+)(,\s*)?\)/g, (match, p1, p2, p3, p4) => {
  if (p3.includes('runStateRef.current.objects')) {
    return `evalExpr(${p1}, ${p2}, ${p3}, runStateRef.current.velocities)`;
  }
  return match;
});

fs.writeFileSync('app/page.tsx', modified);
console.log('Done replacement');
