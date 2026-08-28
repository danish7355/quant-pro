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
  riskAmountUsd: number;
  reason?: string;
}

export function calculatePositionSize(
  accountBalance: number,
  riskPct: number, // e.g. 1% or 2%
  positionSizePct: number, // e.g. 10%
  entryPrice: number,
  stopPrice: number,
  leverageSetting: number,
  maxLeverageCap: number = 20,
  maxExposurePct: number = 80,
  currentTotalExposureUsd: number = 0
): PositionSizeResult {
  if (accountBalance <= 0 || entryPrice <= 0) {
    return { allowed: false, positionSizeUsd: 0, allocatedMargin: 0, quantity: 0, leverage: 1, riskAmountUsd: 0, reason: 'Invalid balance or entry price' };
  }

  const priceDistance = Math.abs(entryPrice - stopPrice);
  if (priceDistance <= 0) {
    return { allowed: false, positionSizeUsd: 0, allocatedMargin: 0, quantity: 0, leverage: 1, riskAmountUsd: 0, reason: 'Stop price equals entry price' };
  }

  const effectiveLeverage = Math.min(Math.max(1, leverageSetting), maxLeverageCap);
  const riskAmountUsd = accountBalance * (riskPct / 100);

  // 1. Quantity strictly based on Account Risk % (loss at SL = riskAmountUsd)
  let qtyByRisk = riskAmountUsd / priceDistance;
  let marginByRisk = (qtyByRisk * entryPrice) / effectiveLeverage;

  // 2. Cap by max position margin % (e.g. 10% of balance per trade)
  const maxTradeMargin = accountBalance * (positionSizePct / 100);
  if (marginByRisk > maxTradeMargin) {
    marginByRisk = maxTradeMargin;
    qtyByRisk = (marginByRisk * effectiveLeverage) / entryPrice;
  }

  // 3. Cap by total available account margin
  const maxAvailableMargin = Math.max(0, (accountBalance * (maxExposurePct / 100)) - currentTotalExposureUsd);
  if (marginByRisk > maxAvailableMargin) {
    marginByRisk = maxAvailableMargin;
    qtyByRisk = (marginByRisk * effectiveLeverage) / entryPrice;
  }

  // Balance sanity guard
  if (marginByRisk <= 0 || qtyByRisk <= 0 || marginByRisk > accountBalance * 0.95) {
    return {
      allowed: false,
      positionSizeUsd: 0,
      allocatedMargin: 0,
      quantity: 0,
      leverage: effectiveLeverage,
      riskAmountUsd,
      reason: `Insufficient margin capacity (Calculated margin: $${marginByRisk.toFixed(2)}, Available: $${maxAvailableMargin.toFixed(2)})`
    };
  }

  const positionSizeUsd = qtyByRisk * entryPrice;

  return {
    allowed: true,
    positionSizeUsd,
    allocatedMargin: marginByRisk,
    quantity: qtyByRisk,
    leverage: effectiveLeverage,
    riskAmountUsd
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
