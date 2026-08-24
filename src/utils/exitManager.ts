/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Position, TradeLog } from '../types';

export interface ExitEvaluationResult {
  shouldExit: boolean;
  exitReason?: TradeLog['exitReason'];
  exitPrice?: number;
  partialRatio?: number; // 0.4 for 40%, 1.0 for full
  updatedPosition?: Position;
  logMessage?: string;
}

export function evaluatePositionExit(
  pos: Position,
  currentPrice: number,
  candlesElapsed: number = 0,
  maxHoldCandles: number = 24,
  regimeFlipped: boolean = false
): ExitEvaluationResult {
  const isLong = pos.direction === 'LONG';
  
  // 1. Check Stop Loss (SL)
  const slHit = isLong ? currentPrice <= pos.sl : currentPrice >= pos.sl;
  if (slHit) {
    return {
      shouldExit: true,
      exitReason: 'SL',
      exitPrice: pos.sl,
      partialRatio: 1.0,
      logMessage: `🔴 Stop Loss Hit on ${pos.symbol} at $${pos.sl.toLocaleString(undefined, { maximumFractionDigits: 8 })}`
    };
  }

  // 2. Check Trailing Stop (TS) if active
  if (pos.trailingStopActive && pos.trailingStop !== null) {
    const tsHit = isLong ? currentPrice <= pos.trailingStop : currentPrice >= pos.trailingStop;
    if (tsHit) {
      return {
        shouldExit: true,
        exitReason: 'TS',
        exitPrice: pos.trailingStop,
        partialRatio: 1.0,
        logMessage: `🛡️ Trailing Stop Hit on ${pos.symbol} at $${pos.trailingStop.toLocaleString(undefined, { maximumFractionDigits: 8 })}`
      };
    }
  }

  // 3. Update Trailing Stop level (GUARANTEE: NEVER MOVES BACKWARD / RELAXES)
  let newPos = { ...pos, currentPrice };
  const atr = pos.entryAtr || currentPrice * 0.02;
  const trailDistance = atr * 1.5;

  // Activation condition: Price reached TP1 or moved 1.0 ATR into profit
  const profitDistance = isLong ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice);
  const isProfitTargetReached = isLong ? currentPrice >= pos.tp1 : currentPrice <= pos.tp1;

  if (isProfitTargetReached || profitDistance >= atr) {
    newPos.trailingStopActive = true;
    const candidateTs = isLong ? currentPrice - trailDistance : currentPrice + trailDistance;

    if (pos.trailingStop === null) {
      newPos.trailingStop = candidateTs;
    } else {
      // INVARIANT CHECK: Stop loss only tightens, never relaxes
      if (isLong) {
        newPos.trailingStop = Math.max(pos.trailingStop, candidateTs);
      } else {
        newPos.trailingStop = Math.min(pos.trailingStop, candidateTs);
      }
    }
  }

  // 4. Check Take Profit 1 (TP1) Partial
  if (pos.sizeRemainingPct === 100 && (isLong ? currentPrice >= pos.tp1 : currentPrice <= pos.tp1)) {
    newPos.sizeRemainingPct = 60;
    // Move SL to Breakeven
    newPos.sl = isLong ? Math.max(newPos.sl, pos.entryPrice) : Math.min(newPos.sl, pos.entryPrice);
    return {
      shouldExit: false, // Partial, keep position active
      exitReason: 'TP1',
      exitPrice: pos.tp1,
      partialRatio: 0.4,
      updatedPosition: newPos,
      logMessage: `🎯 TP1 Reached on ${pos.symbol}. Scaled out 40%, SL moved to breakeven ($${newPos.sl.toLocaleString(undefined, { maximumFractionDigits: 8 })})`
    };
  }

  // 5. Check Take Profit 2 (TP2)
  if (pos.sizeRemainingPct === 60 && (isLong ? currentPrice >= pos.tp2 : currentPrice <= pos.tp2)) {
    newPos.sizeRemainingPct = 20;
    return {
      shouldExit: false,
      exitReason: 'TP2',
      exitPrice: pos.tp2,
      partialRatio: 0.4,
      updatedPosition: newPos,
      logMessage: `🎯 TP2 Reached on ${pos.symbol}. Scaled out additional 40%`
    };
  }

  // 6. Check Take Profit 3 (TP3 - Full exit)
  if (isLong ? currentPrice >= pos.tp3 : currentPrice <= pos.tp3) {
    return {
      shouldExit: true,
      exitReason: 'TP3',
      exitPrice: pos.tp3,
      partialRatio: 1.0,
      logMessage: `🎯 Final TP3 Reached on ${pos.symbol}. Position closed.`
    };
  }

  // 7. Check Time-Based Exit
  if (candlesElapsed >= maxHoldCandles) {
    return {
      shouldExit: true,
      exitReason: 'TIME_EXIT',
      exitPrice: currentPrice,
      partialRatio: 1.0,
      logMessage: `⏱️ Time-Based Max Duration Exit triggered for ${pos.symbol} after ${candlesElapsed} candles.`
    };
  }

  // 8. Check Regime Flip Exit
  if (regimeFlipped) {
    return {
      shouldExit: true,
      exitReason: 'DECAY',
      exitPrice: currentPrice,
      partialRatio: 1.0,
      logMessage: `⚡ Regime Flip Exit triggered for ${pos.symbol} due to trend collapse.`
    };
  }

  return { shouldExit: false, updatedPosition: newPos };
}
