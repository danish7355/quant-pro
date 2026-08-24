const fs = require('fs');
let code = fs.readFileSync('src/utils/indicators.ts', 'utf8');

const target1 = `      if (crDirection !== 'NEUTRAL') {
        return {
          score: 100,
          direction: crDirection,
          status: 'TRENDING',
          reason: crReason,
          indicators: completeIndDetails,
          gates: { ...defaultGates, g1: true, g2: true, g3: true, g4: true, g5: true, g6: true, g7: true, g8: true, g9: true, g10: true, blockReasons: [] },
          wmPattern: 'NONE',
          regime
        };
      }
    }
    return {
      score: 0,
      direction: 'NEUTRAL',
      status: regime.label,
      reason: 'No climax reversal pattern detected',
      indicators: completeIndDetails,
      gates: { ...defaultGates, blockReasons: [] },
      wmPattern: 'NONE',
      regime
    };
  }`;

const replacement1 = `      if (crDirection !== 'NEUTRAL') {
        return {
          score: 100,
          direction: crDirection,
          status: 'TRENDING',
          reason: crReason,
          indicators: completeIndDetails,
          gates: { ...defaultGates, g1: true, g2: true, g3: true, g4: true, g5: true, g6: true, g7: true, g8: true, g9: true, g10: true, blockReasons: [] },
          wmPattern: 'NONE',
          regime
        };
      }
    }
    // For climax reversal that didn't match, we still compute the base SMC score for the UI
    // so the score column isn't filled with zeros.
  }`;

code = code.replace(target1, replacement1);

const target2 = `  return {
    score: Math.round(confidence * 100),
    direction: dir,
    status: regime.label,
    reason: entryAllowed ? 'All gates passed' : gates.blockReasons.join(' | '),
    indicators: completeIndDetails,
    gates,
    wmPattern: 'NONE',
    regime
  };
}`;

const replacement2 = `  let finalDir = dir;
  let finalReason = entryAllowed ? 'All gates passed' : gates.blockReasons.join(' | ');

  if (params.activeStrategy === 'climax_reversal') {
     // If we reached here, it means climax reversal didn't match
     finalDir = 'NEUTRAL';
     finalReason = 'No climax reversal pattern detected';
  }

  return {
    score: Math.round(confidence * 100),
    direction: finalDir,
    status: regime.label,
    reason: finalReason,
    indicators: completeIndDetails,
    gates,
    wmPattern: 'NONE',
    regime
  };
}`;

code = code.replace(target2, replacement2);
fs.writeFileSync('src/utils/indicators.ts', code);
