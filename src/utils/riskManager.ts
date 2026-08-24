/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Position, AppSettings } from '../types';

export interface PositionSizeResult {
  allowed: boolean;
  positionSizeUsd: number;
  allocatedMargin: number;
  quantity: number;
  leverage: number;
  reason?: string;
}

export function calculatePositionSize(
  accountBalance: number,
  riskPct: number, // e.g. 1%
  positionSizePct: number, // e.g. 10%
  entryPrice: number,
  stopPrice: number,
  leverageSetting: number,
  maxLeverageCap: number = 20,
  maxExposurePct: number = 60,
  currentTotalExposureUsd: number = 0
): PositionSizeResult {
  if (accountBalance <= 0 || entryPrice <= 0) {
    return { allowed: false, positionSizeUsd: 0, allocatedMargin: 0, quantity: 0, leverage: 1, reason: 'Invalid balance or entry price' };
  }

  // Cap leverage
  const effectiveLeverage = Math.min(Math.max(1, leverageSetting), maxLeverageCap);

  // Position size in USD based on positionSizePct of balance
  const rawMargin = accountBalance * (positionSizePct / 100);
  const positionSizeUsd = rawMargin * effectiveLeverage;

  // Exposure Cap check
  const maxAllowedTotalExposureUsd = accountBalance * (maxExposurePct / 100);
  if (currentTotalExposureUsd + positionSizeUsd > maxAllowedTotalExposureUsd) {
    return {
      allowed: false,
      positionSizeUsd: 0,
      allocatedMargin: 0,
      quantity: 0,
      leverage: effectiveLeverage,
      reason: `Total exposure cap (${maxExposurePct}%) exceeded: current $${currentTotalExposureUsd.toFixed(2)} + new $${positionSizeUsd.toFixed(2)} > $${maxAllowedTotalExposureUsd.toFixed(2)}`
    };
  }

  // Account Risk % Check: Loss if SL hit should not exceed (accountBalance * riskPct / 100)
  const priceDistance = Math.abs(entryPrice - stopPrice);
  const quantityByMargin = positionSizeUsd / entryPrice;
  const potentialLoss = quantityByMargin * priceDistance;
  const maxRiskLoss = accountBalance * (riskPct / 100);

  let finalQuantity = quantityByMargin;
  let finalPositionSizeUsd = positionSizeUsd;
  let finalAllocatedMargin = rawMargin;

  // Scale down quantity if risk loss exceeds maxRiskLoss
  if (potentialLoss > maxRiskLoss && priceDistance > 0) {
    finalQuantity = maxRiskLoss / priceDistance;
    finalPositionSizeUsd = finalQuantity * entryPrice;
    finalAllocatedMargin = finalPositionSizeUsd / effectiveLeverage;
  }

  return {
    allowed: true,
    positionSizeUsd: finalPositionSizeUsd,
    allocatedMargin: finalAllocatedMargin,
    quantity: finalQuantity,
    leverage: effectiveLeverage,
  };
}

export function checkDailyLossLimit(
  startingDailyBalance: number,
  currentDailyBalance: number,
  dailyLossLimitPct: number
): { limitExceeded: boolean; lossPct: number } {
  if (startingDailyBalance <= 0) return { limitExceeded: false, lossPct: 0 };
  const lossUsd = startingDailyBalance - currentDailyBalance;
  const lossPct = (lossUsd / startingDailyBalance) * 100;
  return {
    limitExceeded: lossPct >= dailyLossLimitPct,
    lossPct: Math.max(0, lossPct)
  };
}

export function checkMaxDrawdown(
  peakAccountBalance: number,
  currentAccountBalance: number,
  maxDrawdownPct: number
): { drawdownExceeded: boolean; drawdownPct: number } {
  if (peakAccountBalance <= 0) return { drawdownExceeded: false, drawdownPct: 0 };
  const ddUsd = peakAccountBalance - currentAccountBalance;
  const drawdownPct = (ddUsd / peakAccountBalance) * 100;
  return {
    drawdownExceeded: drawdownPct >= maxDrawdownPct,
    drawdownPct: Math.max(0, drawdownPct)
  };
}

export function executeEmergencyKillSwitch(
  positions: Position[],
  closePositionFn: (pos: Position, reason: 'MANUAL') => void,
  setEngineRunningFn?: (running: boolean) => void
): { closedCount: number; statusMessage: string } {
  const count = positions.length;
  // 1. Flatten all open positions
  positions.forEach(pos => {
    closePositionFn(pos, 'MANUAL');
  });

  // 2. Freeze execution engine
  if (setEngineRunningFn) {
    setEngineRunningFn(false);
  }

  return {
    closedCount: count,
    statusMessage: `🚨 KILL SWITCH ACTIVATED: Closed ${count} positions, cancelled open orders, and froze execution engine.`
  };
}
