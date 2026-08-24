const fs = require('fs');
let code = fs.readFileSync('src/utils/indicators.ts', 'utf8');

const target1 = `  // --- DETAILED CONSOLE LOGGING ---
  console.log(\`\\n--- SCORING CALCULATION TRACE ---\`);`;

const replacement1 = `  // --- DETAILED CONSOLE LOGGING ---
  if (Math.random() < 0.05) { // Only log ~5% of calculations to prevent console flooding
    console.log(\`\\n--- SCORING CALCULATION TRACE ---\`);`;

const target2 = `  console.log(\`Final Computed Score: \${Math.round(confidence * 100)}\`);
  console.log(\`-----------------------------------\`);

  let finalDir = dir;`;

const replacement2 = `    console.log(\`Final Computed Score: \${Math.round(confidence * 100)}\`);
    console.log(\`-----------------------------------\`);
  }

  let finalDir = dir;`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);
fs.writeFileSync('src/utils/indicators.ts', code);
