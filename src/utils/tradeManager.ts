import { Position } from '../types';

export interface V3TradeManagerConfig {
  breakeven_trigger_r: number;
  breakeven_buffer_atr_mult: number;
  structure_trail_buffer_atr_mult: number;
  chandelier_atr_mult_base: number;
  chandelier_atr_mult_floor: number;
  profit_floor_trigger_r: number;
  profit_floor_retention_pct: number;
  watchdog_snap_atr_mult: number;
  tp1_fraction: number;
  tp2_fraction: number;
  min_buffer_pct_of_price: number;
}

export const defaultV3Config: V3TradeManagerConfig = {
  breakeven_trigger_r: 0.5,
  breakeven_buffer_atr_mult: 0.15,
  structure_trail_buffer_atr_mult: 0.15,
  chandelier_atr_mult_base: 2.5,
  chandelier_atr_mult_floor: 1.2,
  profit_floor_trigger_r: 1.0,
  profit_floor_retention_pct: 0.5,
  watchdog_snap_atr_mult: 0.5,
  tp1_fraction: 0.35,
  tp2_fraction: 0.30,
  min_buffer_pct_of_price: 0.0005, // 0.05%
};

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TradeManagerResult {
  action: 'NONE' | 'EXIT' | 'PARTIAL_TP1' | 'PARTIAL_TP2';
  exitPrice?: number;
  reason?: string;
  updatedPosition: Position;
  partialRatio?: number;
}

export function getCurrentR(pos: Position, price: number): number {
  const initialRiskDistance = Math.abs(pos.entryPrice - pos.sl); // this might change if SL moves, need initial SL. 
  // We'll store initialRisk in pos or compute it. Wait, tp1 etc are based on initial ATR.
  // Assuming pos.entryAtr was the initial ATR.
  // let's use pos.entryAtr or initial SL if stored.
  // We'll compute it via entryPrice and sl if not stored, but SL changes.
  // Wait, original SL is not preserved. We should rely on entryAtr.
  // Let's assume initial SL distance is derived from entryPrice and tp1/tp2 or entryAtr.
  return pos.direction === 'LONG' ? (price - pos.entryPrice) / pos.entryAtr : (pos.entryPrice - price) / pos.entryAtr;
}

export function getPeakR(pos: Position): number {
  return getCurrentR(pos, pos.maxProfitablePrice || pos.entryPrice);
}

function resolveNewStop(pos: Position, candidates: (number | null)[]): number {
  const active = candidates.filter((c) => c !== null) as number[];
  if (active.length === 0) return pos.trailingStop || pos.sl;
  
  if (pos.direction === 'LONG') {
    const best = Math.max(...active);
    return Math.max(pos.trailingStop || pos.sl, best);
  } else {
    const best = Math.min(...active);
    return Math.min(pos.trailingStop || pos.sl, best);
  }
}

export function manageOpenPositionV3(
  pos: Position,
  candle: Candle, // For real-time this can be { open: price, high: price, low: price, close: price }
  currentAtr: number,
  elapsedHours: number,
  maxHoldHours: number,
  watchdogAlert: boolean = false,
  config: V3TradeManagerConfig = defaultV3Config
): TradeManagerResult {
  const isLong = pos.direction === 'LONG';
  let newPos = { ...pos };

  // Step 1 - Update peak favorable excursion first so we can calculate trailing stops accurately
  const extreme = isLong ? candle.high : candle.low;
  newPos.maxProfitablePrice = newPos.maxProfitablePrice || newPos.entryPrice;
  if (isLong) {
    newPos.maxProfitablePrice = Math.max(newPos.maxProfitablePrice, extreme);
  } else {
    newPos.maxProfitablePrice = Math.min(newPos.maxProfitablePrice, extreme);
  }

  // Step 2 - Calculate stepwise Trailing Stop based on TP hits
  const hitTp1ForTrail = isLong ? (newPos.maxProfitablePrice >= newPos.tp1) : (newPos.maxProfitablePrice <= newPos.tp1);
  const hitTp2ForTrail = isLong ? (newPos.maxProfitablePrice >= newPos.tp2) : (newPos.maxProfitablePrice <= newPos.tp2);

  if (hitTp2ForTrail) {
    newPos.trailingStop = newPos.tp1;
    newPos.trailingStopActive = true;
  } else if (hitTp1ForTrail) {
    newPos.trailingStop = newPos.entryPrice;
    newPos.trailingStopActive = true;
  } else {
    newPos.trailingStop = newPos.sl;
  }

  // Step 3 - Exit check against current stop & final TP
  const currentStop = newPos.trailingStop;
  if (isLong) {
    if (candle.low <= currentStop) return { action: 'EXIT', exitPrice: currentStop, reason: newPos.trailingStopActive ? 'TS' : 'SL', updatedPosition: newPos };
    if (candle.high >= newPos.tp3) return { action: 'EXIT', exitPrice: newPos.tp3, reason: 'TP3', updatedPosition: newPos };
  } else {
    if (candle.high >= currentStop) return { action: 'EXIT', exitPrice: currentStop, reason: newPos.trailingStopActive ? 'TS' : 'SL', updatedPosition: newPos };
    if (candle.low <= newPos.tp3) return { action: 'EXIT', exitPrice: newPos.tp3, reason: 'TP3', updatedPosition: newPos };
  }

  // Step 4 - Partial take-profit ladder
  const currentlyHitTp1 = isLong ? (candle.high >= newPos.tp1) : (candle.low <= newPos.tp1);
  const currentlyHitTp2 = isLong ? (candle.high >= newPos.tp2) : (candle.low <= newPos.tp2);

  if (currentlyHitTp1 && newPos.sizeRemainingPct === 100) {
    newPos.sizeRemainingPct = Math.round(100 - (config.tp1_fraction * 100));
    return { action: 'PARTIAL_TP1', exitPrice: newPos.tp1, reason: 'TP1', partialRatio: config.tp1_fraction, updatedPosition: newPos };
  }
  
  const expectedRemainingAfterTp1 = Math.round(100 - (config.tp1_fraction * 100));
  if (currentlyHitTp2 && newPos.sizeRemainingPct === expectedRemainingAfterTp1) {
    newPos.sizeRemainingPct = Math.round(100 - (config.tp1_fraction * 100) - (config.tp2_fraction * 100));
    return { action: 'PARTIAL_TP2', exitPrice: newPos.tp2, reason: 'TP2', partialRatio: (config.tp2_fraction * 100) / expectedRemainingAfterTp1, updatedPosition: newPos };
  }

  // Step 5 - Time Limit
  if (maxHoldHours > 0 && elapsedHours >= maxHoldHours) {
    return { action: 'EXIT', exitPrice: candle.close, reason: 'TIME_LIMIT', updatedPosition: newPos };
  }

  return { action: 'NONE', updatedPosition: newPos };
}

// =======================================================
// VOLATILITY COMPRESSION BREAKOUT - TREND-FOLLOWING EXIT
// =======================================================
export interface CompressionBreakoutConfig {
  initial_tp_atr_mult: number;    // 1.5 ATR
  initial_tp_close_pct: number;   // 0.25 (25% initial bank)
  chandelier_atr_mult: number;    // 3.0 ATR trail
  round_trip_cost_pct: number;    // 0.0015 (0.15% fee + slippage buffer)
  stall_check_bar: number;        // 8 bars
  stall_min_progress_atr: number; // 1.0 ATR min progress
}

export const defaultCompressionBreakoutConfig: CompressionBreakoutConfig = {
  initial_tp_atr_mult: 1.5,
  initial_tp_close_pct: 0.25,
  chandelier_atr_mult: 3.0,
  round_trip_cost_pct: 0.0015,
  stall_check_bar: 8,
  stall_min_progress_atr: 1.0
};

export function manageCompressionBreakoutPosition(
  pos: Position,
  candle: Candle,
  currentAtr: number,
  barsOpen: number = 0,
  config: CompressionBreakoutConfig = defaultCompressionBreakoutConfig
): TradeManagerResult {
  const isLong = pos.direction === 'LONG';
  let newPos = { ...pos };
  newPos.barsOpen = barsOpen;

  // Step 1: Check Fake Breakout Invalidation strictly on completed bar 1 (not on tick 0)
  if (newPos.barsOpen === 1 && typeof newPos.windowHigh === 'number' && typeof newPos.windowLow === 'number') {
    const isFake = isLong
      ? candle.close < newPos.windowHigh // snapped back inside the box
      : candle.close > newPos.windowLow;

    if (isFake) {
      return {
        action: 'EXIT',
        exitPrice: candle.close,
        reason: 'INVALIDATION',
        updatedPosition: newPos
      };
    }
  }

  // Step 2: Track peak favorable excursion
  const extreme = isLong ? candle.high : candle.low;
  newPos.maxProfitablePrice = newPos.maxProfitablePrice || newPos.entryPrice;
  if (isLong) {
    newPos.maxProfitablePrice = Math.max(newPos.maxProfitablePrice, extreme);
  } else {
    newPos.maxProfitablePrice = Math.min(newPos.maxProfitablePrice, extreme);
  }

  // Step 3: Check Stall Condition (before initial TP)
  const initialTpHit = newPos.initialTpHit || (newPos.sizeRemainingPct < 100);
  if (!initialTpHit && newPos.barsOpen >= config.stall_check_bar) {
    const unrealizedMoveAtr = isLong
      ? (candle.close - newPos.entryPrice) / (newPos.entryAtr || currentAtr)
      : (newPos.entryPrice - candle.close) / (newPos.entryAtr || currentAtr);

    if (unrealizedMoveAtr < config.stall_min_progress_atr) {
      return {
        action: 'EXIT',
        exitPrice: candle.close,
        reason: 'STALL_EXIT',
        updatedPosition: newPos
      };
    }
  }

  // Step 4: Evaluate Initial Take Profit (25% close at 1.5 ATR)
  const initialTpLevel = isLong
    ? newPos.entryPrice + config.initial_tp_atr_mult * (newPos.entryAtr || currentAtr)
    : newPos.entryPrice - config.initial_tp_atr_mult * (newPos.entryAtr || currentAtr);

  const reachedInitialTp = isLong ? candle.high >= initialTpLevel : candle.low <= initialTpLevel;

  if (reachedInitialTp && !initialTpHit && newPos.sizeRemainingPct === 100) {
    newPos.initialTpHit = true;
    newPos.trailingStopActive = true;
    const costBuffer = newPos.entryPrice * config.round_trip_cost_pct;
    // Move SL to breakeven + round-trip cost buffer
    newPos.trailingStop = isLong ? newPos.entryPrice + costBuffer : newPos.entryPrice - costBuffer;
    newPos.sizeRemainingPct = Math.round(100 - (config.initial_tp_close_pct * 100)); // 75% remaining

    return {
      action: 'PARTIAL_TP1',
      exitPrice: initialTpLevel,
      reason: 'TP1',
      partialRatio: config.initial_tp_close_pct,
      updatedPosition: newPos
    };
  }

  // Step 5: Chandelier Trailing Stop (once initial TP hit, trail 3.0 ATR behind peak extreme)
  if (initialTpHit || newPos.trailingStopActive) {
    const candidateStop = isLong
      ? newPos.maxProfitablePrice - config.chandelier_atr_mult * currentAtr
      : newPos.maxProfitablePrice + config.chandelier_atr_mult * currentAtr;

    const currentStop = newPos.trailingStop || newPos.sl;
    // Ratchet only in favorable direction
    newPos.trailingStop = isLong ? Math.max(currentStop, candidateStop) : Math.min(currentStop, candidateStop);
    newPos.trailingStopActive = true;
  } else {
    newPos.trailingStop = newPos.sl;
  }

  // Step 6: Stop Check
  const effectiveStop = newPos.trailingStop || newPos.sl;
  if (isLong) {
    if (candle.low <= effectiveStop) {
      return {
        action: 'EXIT',
        exitPrice: effectiveStop,
        reason: newPos.trailingStopActive ? 'TS' : 'SL',
        updatedPosition: newPos
      };
    }
  } else {
    if (candle.high >= effectiveStop) {
      return {
        action: 'EXIT',
        exitPrice: effectiveStop,
        reason: newPos.trailingStopActive ? 'TS' : 'SL',
        updatedPosition: newPos
      };
    }
  }

  return { action: 'NONE', updatedPosition: newPos };
}
