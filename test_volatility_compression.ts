import { runScoringEngine } from './src/utils/indicators';
import { manageCompressionBreakoutPosition } from './src/utils/tradeManager';
import { Position } from './src/types';

console.log("===============================================================");
console.log(" VCB STRATEGY REFINED TEST SUITE (Volume Contraction + Impulse)");
console.log("===============================================================\n");

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

// Helper: Generate candles matching real chart pattern
// Phase 1: Normal volatility warmup (170 bars)
// Phase 2: Sharp impulse move (20 bars, big directional move = prior impulse)
// Phase 3: Tight compression box with dried-up volume (16 bars)
// Phase 4: Breakout candle with massive volume
function generateRealSetup(dir: 'LONG' | 'SHORT') {
  const candles = [];
  let price = 50000;
  const now = Math.floor(Date.now() / 1000) - 220 * 900;

  // Phase 1: 170 bars normal volatility (establishes ATR baseline)
  for (let i = 0; i < 170; i++) {
    const change = (Math.random() - 0.5) * 400;
    const open = price;
    price += change;
    candles.push({
      time: now + i * 900,
      open,
      high: Math.max(open, price) + Math.random() * 150,
      low: Math.min(open, price) - Math.random() * 150,
      close: price,
      volume: 1000 + Math.random() * 500
    });
  }

  // Phase 2: 20-bar sharp impulse move (prior move = 5+ ATR)
  // For LONG setup: dump down then box at bottom → breakout UP
  // For SHORT setup: pump up then box at top → breakout DOWN
  const impulseDir = dir === 'LONG' ? -1 : 1; // opposite of breakout direction
  for (let i = 170; i < 190; i++) {
    const impulse = impulseDir * (150 + Math.random() * 100);
    const open = price;
    price += impulse;
    candles.push({
      time: now + i * 900,
      open,
      high: Math.max(open, price) + 50,
      low: Math.min(open, price) - 50,
      close: price,
      volume: 1500 + Math.random() * 800 // elevated volume during impulse
    });
  }

  const boxBase = price; // box forms at the end of the impulse

  // Phase 3: 16-bar tight compression box with DRIED-UP volume
  for (let i = 190; i < 206; i++) {
    const open = boxBase + (Math.random() - 0.5) * 20;
    const close = boxBase + (Math.random() - 0.5) * 20;
    candles.push({
      time: now + i * 900,
      open,
      high: Math.max(open, close) + 8,
      low: Math.min(open, close) - 8,
      close,
      volume: 150 + Math.random() * 100 // ~200 avg vs ~1200 pre-box = ~17% contraction ✓
    });
  }

  // Phase 4: Breakout candle with massive volume & strong body
  if (dir === 'LONG') {
    candles.push({
      time: now + 206 * 900,
      open: boxBase + 10,
      high: boxBase + 800,
      low: boxBase - 5,
      close: boxBase + 780, // close near high (strong body)
      volume: 3000 // 15x box volume
    });
  } else {
    candles.push({
      time: now + 206 * 900,
      open: boxBase - 10,
      high: boxBase + 5,
      low: boxBase - 800,
      close: boxBase - 780, // close near low (strong body)
      volume: 3000
    });
  }

  return candles;
}

// Helper: Generate FAKE setup (no volume contraction, no prior impulse)
function generateFakeSetup() {
  const candles = [];
  let price = 50000;
  const now = Math.floor(Date.now() / 1000) - 220 * 900;

  // 200 bars of flat sideways with normal volume (no impulse, no contraction)
  for (let i = 0; i < 206; i++) {
    const change = (Math.random() - 0.5) * 30; // tiny moves
    const open = price;
    price += change;
    candles.push({
      time: now + i * 900,
      open,
      high: Math.max(open, price) + 10,
      low: Math.min(open, price) - 10,
      close: price,
      volume: 1000 + Math.random() * 200 // consistent volume throughout
    });
  }

  // "Breakout" candle (but from a fake setup — no prior move, no vol contraction)
  candles.push({
    time: now + 206 * 900,
    open: price,
    high: price + 500,
    low: price - 5,
    close: price + 480,
    volume: 2500
  });

  return candles;
}

// ══════════════════════════════════════
// TEST 1A: Real LONG Breakout Detection
// ══════════════════════════════════════
const longCandles = generateRealSetup('LONG');
const longRes = runScoringEngine(longCandles, dummySettings);
console.log("TEST 1A — Real LONG Breakout (dump → box → breakout UP):");
console.log(`  Direction: ${longRes.direction}, Score: ${longRes.score}, Status: ${longRes.status}`);
console.log(`  Reason: ${longRes.reason}`);
console.log(`  >>> ${longRes.direction === 'LONG' && longRes.score >= 45 && longRes.status === 'BREAKOUT_EXPANSION' ? '✅ PASS' : '❌ FAIL'}`);

// ══════════════════════════════════════
// TEST 1B: Real SHORT Breakout Detection
// ══════════════════════════════════════
const shortCandles = generateRealSetup('SHORT');
const shortRes = runScoringEngine(shortCandles, dummySettings);
console.log(`\nTEST 1B — Real SHORT Breakout (pump → box → breakout DOWN):`);
console.log(`  Direction: ${shortRes.direction}, Score: ${shortRes.score}, Status: ${shortRes.status}`);
console.log(`  Reason: ${shortRes.reason}`);
console.log(`  >>> ${shortRes.direction === 'SHORT' && shortRes.score <= -45 && shortRes.status === 'BREAKOUT_EXPANSION' ? '✅ PASS' : '❌ FAIL'}`);

// ══════════════════════════════════════
// TEST 2: Fake Setup FILTERED OUT
// ══════════════════════════════════════
const fakeCandles = generateFakeSetup();
const fakeRes = runScoringEngine(fakeCandles, dummySettings);
console.log(`\nTEST 2 — Fake Setup (no prior impulse, no volume contraction):`);
console.log(`  Direction: ${fakeRes.direction}, Score: ${fakeRes.score}, Status: ${fakeRes.status}`);
console.log(`  Reason: ${fakeRes.reason}`);
const fakeFiltered = fakeRes.status !== 'BREAKOUT_EXPANSION';
console.log(`  >>> ${fakeFiltered ? '✅ PASS — Fake correctly REJECTED (no breakout signal)' : '❌ FAIL — Fake should have been filtered!'}`);

// ══════════════════════════════════════
// TEST 3: Trade Manager Lifecycle
// ══════════════════════════════════════
console.log(`\nTEST 3 — Chandelier Trail & Fake Breakout Invalidation:`);
const testPos: Position = {
  id: 'p1', symbol: 'BTCUSDT', direction: 'LONG', entryPrice: 50800, currentPrice: 50800,
  quantity: 1.0, leverage: 10, allocatedBalance: 5080,
  tp1: 51250, tp2: 51700, tp3: 52300, sl: 49910,
  trailingStop: null, trailingStopActive: false,
  entryAtr: 300, timeOpen: new Date().toISOString(), scoreAtEntry: 85,
  unrealizedPnl: 0, realizedPnl: 0, sizeRemainingPct: 100,
  windowHigh: 50015, windowLow: 49985, barsOpen: 0
};

// Bar 1: Progress (no exit)
const m1 = manageCompressionBreakoutPosition(testPos, { open: 51000, high: 51350, low: 51000, close: 51300 }, 300, 2);
// Bar 2: Chandelier trail up
const m2 = manageCompressionBreakoutPosition(m1.updatedPosition, { open: 52400, high: 53000, low: 52400, close: 52900 }, 300, 3);
// Bar 3: Pullback hits chandelier
const m3 = manageCompressionBreakoutPosition(m2.updatedPosition, { open: 52900, high: 52900, low: 52000, close: 52050 }, 300, 4);
console.log(`  [TP1 Bank] Action: ${m1.action}, Remaining: ${m1.updatedPosition.sizeRemainingPct}%`);
console.log(`  [Trail]    Stop: ${m2.updatedPosition.trailingStop}`);
console.log(`  [Exit]     Action: ${m3.action}, Reason: ${m3.reason}, Price: ${m3.exitPrice}`);
console.log(`  >>> ${m1.action === 'PARTIAL_TP1' && m3.action === 'EXIT' && m3.reason === 'TS' ? '✅ PASS' : '❌ FAIL'}`);

// Fake breakout invalidation
const fakePos: Position = { ...testPos, barsOpen: 0 };
const inv = manageCompressionBreakoutPosition(fakePos, { open: 50800, high: 50800, low: 49900, close: 50010 }, 300, 1);
console.log(`  [Invalidation] Action: ${inv.action}, Reason: ${inv.reason}`);
console.log(`  >>> ${inv.action === 'EXIT' && inv.reason === 'INVALIDATION' ? '✅ PASS' : '❌ FAIL'}`);

console.log("\n===============================================================");
console.log("                  VCB REFINED TEST SUITE COMPLETE              ");
console.log("===============================================================");
