const fs = require('fs');
let code = fs.readFileSync('src/utils/indicators.ts', 'utf8');

const target1 = `  let confidence = (( (mandatoryPass ? 7 : 0) + confCount ) / 10 * 0.6) + ((regime.score / 100) * 0.4);

  let finalDir = dir;`;

const replacement1 = `  let confidence = (( (mandatoryPass ? 7 : 0) + confCount ) / 10 * 0.6) + ((regime.score / 100) * 0.4);

  // --- DETAILED CONSOLE LOGGING ---
  console.log(\`\\n--- SCORING CALCULATION TRACE ---\`);
  console.log(\`Closes: \${close}, Highs: \${highs[idx]}, Lows: \${lows[idx]}, Volumes: \${volCurrent}\`);
  console.log(\`Indicators calculated:\`);
  console.log(\` - EMA (Fast/Slow/Trend): \${emaS.toFixed(2)} / \${emaM.toFixed(2)} / \${emaL.toFixed(2)}\`);
  console.log(\` - RSI: \${rsi.toFixed(2)}\`);
  console.log(\` - ADX: \${adx.toFixed(2)} (+DI: \${adxResult.plusDI[idx].toFixed(2)}, -DI: \${adxResult.minusDI[idx].toFixed(2)})\`);
  console.log(\` - VWAP: \${vwap.toFixed(2)} (Deviation: \${(((close - vwap)/vwap)*100).toFixed(2)}%)\`);
  console.log(\` - ATR: \${atrCurrent.toFixed(2)} (Sma5: \${atrSma5.toFixed(2)})\`);
  console.log(\` - Vol Ratio: \${(volCurrent / vol20Ma).toFixed(2)}x (Current: \${volCurrent}, 20MA: \${vol20Ma})\`);
  console.log(\`Regime Breakdown:\`);
  console.log(\` - Direction: \${regime.direction}\`);
  console.log(\` - Component Scores: EMA(\${regime.componentScores.ema}), ADX(\${regime.componentScores.adx}), VWAP(\${regime.componentScores.vwap}), ATR(\${regime.componentScores.atr_expansion}), VOL(\${regime.componentScores.volume})\`);
  console.log(\` - Total Regime Score: \${regime.score} (\${regime.label})\`);
  console.log(\`Gates Evaluation:\`, JSON.stringify(gates));
  console.log(\` - Mandatory Pass: \${mandatoryPass}\`);
  console.log(\` - Confirmation Count: \${confCount}\`);
  console.log(\`Confidence calc: (((\${mandatoryPass ? 7 : 0} + \${confCount}) / 10 * 0.6) + ((\${regime.score} / 100) * 0.4)) = \${confidence}\`);
  console.log(\`Final Computed Score: \${Math.round(confidence * 100)}\`);
  console.log(\`-----------------------------------\`);

  let finalDir = dir;`;

code = code.replace(target1, replacement1);
fs.writeFileSync('src/utils/indicators.ts', code);
