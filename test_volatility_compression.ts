import { runScoringEngine } from './src/utils/indicators';
import { manageCompressionBreakoutPosition } from './src/utils/tradeManager';
import { Position } from './src/types';

console.log("=================================================");
console.log("TESTING VOLATILITY COMPRESSION BREAKOUT STRATEGY");
console.log("=================================================\n");

// 1. Generate Synthetic Candles for Compression + Breakout (220 candles total)
function generateCompressionBreakoutCandles(direction: 'LONG' | 'SHORT' = 'LONG') {
  const candles = [];
  let price = 50000;
  const now = Math.floor(Date.now() / 1000) - 220 * 900;

  // Warmup candles (194 candles normal volatility)
  for (let i = 0; i < 194; i++) {
    const change = (Math.random() - 0.49) * 400;
    const open = price;
    price += change;
    const high = Math.max(open, price) + Math.random() * 200;
    const low = Math.min(open, price) - Math.random() * 200;
    candles.push({
      time: now + i * 900,
      open,
      high,
      low,
      close: price,
      volume: 1000 + Math.random() * 500
    });
  }

  // 16 Compression Candles (tight box, range ~ 40, low volume ~ 200)
  const baseBoxPrice = 50000;
  for (let i = 194; i < 210; i++) {
    const open = baseBoxPrice + (Math.random() - 0.5) * 20;
    const close = baseBoxPrice + (Math.random() - 0.5) * 20;
    const high = Math.max(open, close) + 10;
    const low = Math.min(open, close) - 10;
    candles.push({
      time: now + i * 900,
      open,
      high,
      low,
      close,
      volume: 200
    });
  }

  // Breakout Candle (Bar 210)
  if (direction === 'LONG') {
    candles.push({
      time: now + 210 * 900,
      open: 50020,
      high: 50820,
      low: 50010,
      close: 50800,
      volume: 2500
    });
  } else {
    // SHORT breakout downwards
    candles.push({
      time: now + 210 * 900,
      open: 49980,
      high: 49990,
      low: 49180,
      close: 49200,
      volume: 2500
    });
  }

  return candles;
}

const dummySettings: any = {
  activeStrategy: 'volatility_compression_breakout',
  timeframe: '15m',
  autoTradeThreshold: 60,
  atrPeriod: 14,
  min24hVolume: 0,
  maxSpread: 10,
  adxTrendThreshold: 10,
  minRRRatio: 1.0,
  accountRiskPct: 1,
  positionSizePct: 10,
  leverage: 10
};

// TEST 1: LONG Breakout Detection
const longCandles = generateCompressionBreakoutCandles('LONG');
const longResult = runScoringEngine(longCandles, dummySettings);
console.log("TEST 1A - LONG Breakout Signal Detection:");
console.log("  Direction:", longResult.direction);
console.log("  Score:", longResult.score);
console.log("  Status:", longResult.status);
console.log("  Reason:", longResult.reason);

if (longResult.direction === 'LONG' && longResult.score >= 60 && longResult.status === 'BREAKOUT_EXPANSION') {
  console.log("  >>> ✅ TEST 1A PASSED: Strong LONG Breakout identified with positive score >= 60!");
} else {
  console.log("  >>> ❌ TEST 1A FAILED");
}

// TEST 1B: SHORT Breakout Detection
const shortCandles = generateCompressionBreakoutCandles('SHORT');
const shortResult = runScoringEngine(shortCandles, dummySettings);
console.log("\nTEST 1B - SHORT Breakout Signal Detection:");
console.log("  Direction:", shortResult.direction);
console.log("  Score:", shortResult.score);
console.log("  Status:", shortResult.status);
console.log("  Reason:", shortResult.reason);

if (shortResult.direction === 'SHORT' && shortResult.score <= -60 && shortResult.status === 'BREAKOUT_EXPANSION') {
  console.log("  >>> ✅ TEST 1B PASSED: Strong SHORT Breakout identified with negative score <= -60!");
} else {
  console.log("  >>> ❌ TEST 1B FAILED");
}

// TEST 2: Trade Manager Exit & Chandelier Trail Lifecycle (LONG)
console.log("\nTEST 2 - Trade Manager Trend-Following Chandelier Lifecycle (LONG):");

const mockPosition: Position = {
  id: 'test_pos_1',
  symbol: 'BTCUSDT',
  direction: 'LONG',
  entryPrice: 50800,
  currentPrice: 50800,
  quantity: 1.0,
  leverage: 10,
  allocatedBalance: 5080,
  tp1: 50800 + 1.5 * 300, // 51250 (1.5 ATR)
  tp2: 50800 + 3.0 * 300,
  tp3: 50800 + 5.0 * 300,
  sl: 50000 - 0.3 * 300,  // 49910
  trailingStop: null,
  trailingStopActive: false,
  entryAtr: 300,
  timeOpen: new Date().toISOString(),
  scoreAtEntry: 85,
  unrealizedPnl: 0,
  realizedPnl: 0,
  sizeRemainingPct: 100,
  windowHigh: 50040,
  windowLow: 49960,
  barsOpen: 0
};

// Bar 1: Normal progress to 51000 (No exit)
const res1 = manageCompressionBreakoutPosition(mockPosition, { open: 50800, high: 51100, low: 50800, close: 51000 }, 300, 1);
console.log("  Bar 1 (Price 51000) -> Action:", res1.action, "| Stop:", res1.updatedPosition.trailingStop || res1.updatedPosition.sl);

// Bar 2: Hits Initial TP1 at 51300 (Bank 25%, Stop moves to Breakeven + cost buffer)
const res2 = manageCompressionBreakoutPosition(res1.updatedPosition, { open: 51000, high: 51350, low: 51000, close: 51300 }, 300, 2);
console.log("  Bar 2 (Price 51300 - Hit TP1) -> Action:", res2.action, "| Reason:", res2.reason, "| Remaining:", res2.updatedPosition.sizeRemainingPct + "%", "| Stop:", res2.updatedPosition.trailingStop);

// Bar 3: Huge Expansion to 53000 (Chandelier trails 3.0 ATR = 900 below 53000 -> Stop = 52100)
const res3 = manageCompressionBreakoutPosition(res2.updatedPosition, { open: 52400, high: 53000, low: 52400, close: 52900 }, 300, 3);
console.log("  Bar 3 (Price 53000 - Trend Run) -> Action:", res3.action, "| Chandelier Stop:", res3.updatedPosition.trailingStop);

// Bar 4: Pullback to 52000 (Hits Chandelier Stop at 52100 -> FULL EXIT with massive trend profits)
const res4 = manageCompressionBreakoutPosition(res3.updatedPosition, { open: 52900, high: 52900, low: 52000, close: 52050 }, 300, 4);
console.log("  Bar 4 (Pullback to 52000) -> Action:", res4.action, "| Reason:", res4.reason, "| ExitPrice:", res4.exitPrice);

if (res2.action === 'PARTIAL_TP1' && res2.updatedPosition.sizeRemainingPct === 75 && res3.action === 'NONE' && res4.action === 'EXIT' && res4.reason === 'TS') {
  console.log("  >>> ✅ TEST 2 PASSED: 25% Partial banked at TP1, and remaining 75% trend-followed via Chandelier Trail until TS exit!");
} else {
  console.log("  >>> ❌ TEST 2 FAILED: Lifecycle mismatch");
}

// TEST 3: Fake Breakout Invalidation Check
console.log("\nTEST 3 - Fake Breakout Invalidation on Bar 1:");
const mockFakePosition: Position = {
  ...mockPosition,
  barsOpen: 0,
  windowHigh: 50040,
  windowLow: 49960
};
// Next candle immediately snaps back inside box below 50040
const resFake = manageCompressionBreakoutPosition(mockFakePosition, { open: 50800, high: 50800, low: 49900, close: 50010 }, 300, 1);
console.log("  Fake Breakout Bar (Close 50010 < Box High 50040) -> Action:", resFake.action, "| Reason:", resFake.reason);

if (resFake.action === 'EXIT' && resFake.reason === 'INVALIDATION') {
  console.log("  >>> ✅ TEST 3 PASSED: Fake breakout immediately killed on bar 1 with INVALIDATION exit!");
} else {
  console.log("  >>> ❌ TEST 3 FAILED: Fake breakout not invalidated");
}
