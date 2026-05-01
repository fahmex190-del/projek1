const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

// The replacement is inside runNode
let parts = code.split('const runNode = async');
let rest = parts[1];

rest = rest.replace(/evalExpr\([\s\S]*?runStateRef\.current\.velocities,\s*\)/g, (match) => {
  return match.replace(/runStateRef\.current\.velocities,\s*\)/, 'runStateRef.current.velocities, objId)');
});

code = parts[0] + 'const runNode = async' + rest;
fs.writeFileSync('app/page.tsx', code);
