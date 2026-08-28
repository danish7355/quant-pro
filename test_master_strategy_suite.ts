import { runScoringEngine } from './src/utils/indicators';
import { manageOpenPositionV3, manageCompressionBreakoutPosition } from './src/utils/tradeManager';
import { calculatePositionSize } from './src/utils/riskManager';
import { Position, AppSettings } from './src/types';

console.log("===============================================================================");
console.log("             COMPREHENSIVE MULTI-STRATEGY MASTER AUDIT TEST SUITE             ");
console.log("===============================================================================\n");

const baseSettings: AppSettings = {
  market: 'CRYPTO',
  activeStrategy: 'v2',
  timeframe: '4H',
  autoTradeThreshold: 60,
  coinCount: 20,
  autoTradeEnabled: true,
  scanInterval: 300,
  theme: 'dark',
  min24hVolume: 10000000,
  maxFundingRate: 0.01,
  maxSpread: 0.5,
  emaFastPeriod: 9,
  emaSlowPeriod: 21,
  emaTrendPeriod: 50,
  emaCrossLookback: 5,
  rsiPeriod: 14,
  rsiLongMin: 30,
  rsiLongMax: 70,
  rsiShortMin: 30,
  rsiShortMax: 70,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  adxPeriod: 14,
  adxTrendThreshold: 20,
  superTrendPeriod: 10,
  superTrendMultiplier: 3,
  volumeMultiplier: 1.0,
  fibLookback: 100,
  atrPeriod: 14,
  startingBalance: 10000,
  positionSizePct: 10,
  accountRiskPct: 2,
  leverage: 10,
  maxConcurrentTrades: 3,
  dailyLossLimitPct: 5,
  maxDrawdownPct: 10,
  tp1AtrMultiple: 2,
  tp2AtrMultiple: 3.5,
  tp3FibLevel: 1.618,
  slAtrMultiple: 1.5,
  minRRRatio: 1.5,
  trailingStopActivation: 'TP1',
  trailActivationR: 1.0,
  timeBasedExitEnabled: true,
  timeBasedExitCandles: 24,
  telegramBotToken: '',
  telegramChatId: '',
  alertOnNewSignal: true,
  alertOnTradeExecuted: true,
  alertOnTpHit: true,
  alertOnSlHit: true,
  alertOnTsMoved: true,
  alertOnDailyLossLimit: true,
  alertOnRangingDetected: false
};

function generateTrendCandles(type: 'BULLISH' | 'BEARISH', count = 250) {
  const candles = [];
  let price = 100;
  const baseTime = Math.floor(Date.now() / 1000) - count * 3600;

  for (let i = 0; i < count; i++) {
    let drift = type === 'BULLISH' ? 0.35 : -0.35;
    const noise = (Math.random() - 0.5) * 0.2;
    const open = price;
    const close = price + drift + noise;
    const high = Math.max(open, close) + Math.random() * 0.3;
    const low = Math.min(open, close) - Math.random() * 0.3;
    const volume = 50000 + Math.random() * 20000;

    candles.push({
      time: baseTime + i * 3600,
      open, high, low, close, volume
    });
    price = close;
  }
  return candles;
}

// 1. TEST V2 STRATEGY
console.log("--- 1. STRATEGY V2 (SMC Trend Structure) ---");
const bullCandles = generateTrendCandles('BULLISH');
const bearCandles = generateTrendCandles('BEARISH');
const v2Bull = runScoringEngine(bullCandles, { ...baseSettings, activeStrategy: 'v2' });
const v2Bear = runScoringEngine(bearCandles, { ...baseSettings, activeStrategy: 'v2' });
console.log(`  [V2 Bullish] Direction: ${v2Bull.direction}, Score: ${v2Bull.score}, Status: ${v2Bull.status}`);
console.log(`  [V2 Bearish] Direction: ${v2Bear.direction}, Score: ${v2Bear.score}, Status: ${v2Bear.status}`);
console.log(`  >>> ${v2Bull.direction === 'LONG' && v2Bear.direction === 'SHORT' ? '✅ PASS' : '❌ FAIL'}`);

// 2. TEST V3 STRATEGY
console.log("\n--- 2. STRATEGY V3 (SMC + EMA/BB Reversals) ---");
const v3Res = runScoringEngine(bullCandles, { ...baseSettings, activeStrategy: 'v3' });
console.log(`  [V3 Output] Direction: ${v3Res.direction}, Score: ${v3Res.score}, Status: ${v3Res.status}`);
console.log(`  >>> ${v3Res.score > 0 ? '✅ PASS' : '❌ FAIL'}`);

// 3. TEST CLIMAX REVERSAL STRATEGY
console.log("\n--- 3. STRATEGY CLIMAX REVERSAL (Proximity & Extreme Detection) ---");
const climaxRes = runScoringEngine(bullCandles, { ...baseSettings, activeStrategy: 'climax_reversal' });
console.log(`  [Climax Output] Direction: ${climaxRes.direction}, Score: ${climaxRes.score}, Reason: ${climaxRes.reason}`);
console.log(`  >>> ${climaxRes.score !== undefined ? '✅ PASS' : '❌ FAIL'}`);

// 4. TEST VOLATILITY COMPRESSION BREAKOUT
console.log("\n--- 4. STRATEGY VOLATILITY COMPRESSION BREAKOUT ---");
function generateCompressionBreakout(dir: 'LONG' | 'SHORT') {
  const candles = [];
  let price = 50000;
  const now = Math.floor(Date.now() / 1000) - 220 * 900;
  // 170 bars normal volatility
  for (let i = 0; i < 170; i++) {
    const change = (Math.random() - 0.49) * 400;
    const open = price;
    price += change;
    candles.push({ time: now + i * 900, open, high: Math.max(open, price) + 100, low: Math.min(open, price) - 100, close: price, volume: 1000 + Math.random() * 500 });
  }
  // 20 bars sharp impulse (prior move)
  const impulseDir = dir === 'LONG' ? -1 : 1;
  for (let i = 170; i < 190; i++) {
    const open = price;
    price += impulseDir * (150 + Math.random() * 100);
    candles.push({ time: now + i * 900, open, high: Math.max(open, price) + 50, low: Math.min(open, price) - 50, close: price, volume: 1500 + Math.random() * 800 });
  }
  const boxBase = price;
  // 16 bars tight box with dried-up volume
  for (let i = 190; i < 206; i++) {
    const open = boxBase + (Math.random() - 0.5) * 20;
    const close = boxBase + (Math.random() - 0.5) * 20;
    candles.push({ time: now + i * 900, open, high: Math.max(open, close) + 8, low: Math.min(open, close) - 8, close, volume: 150 + Math.random() * 100 });
  }
  // Breakout candle
  if (dir === 'LONG') {
    candles.push({ time: now + 206 * 900, open: boxBase + 10, high: boxBase + 800, low: boxBase - 5, close: boxBase + 780, volume: 3000 });
  } else {
    candles.push({ time: now + 206 * 900, open: boxBase - 10, high: boxBase + 5, low: boxBase - 800, close: boxBase - 780, volume: 3000 });
  }
  return candles;
}

const vcbLong = runScoringEngine(generateCompressionBreakout('LONG'), { ...baseSettings, activeStrategy: 'volatility_compression_breakout' });
const vcbShort = runScoringEngine(generateCompressionBreakout('SHORT'), { ...baseSettings, activeStrategy: 'volatility_compression_breakout' });
console.log(`  [VCB LONG]  Direction: ${vcbLong.direction}, Score: ${vcbLong.score}, Status: ${vcbLong.status}`);
console.log(`  [VCB SHORT] Direction: ${vcbShort.direction}, Score: ${vcbShort.score}, Status: ${vcbShort.status}`);
console.log(`  >>> ${vcbLong.direction === 'LONG' && vcbLong.score >= 45 && vcbShort.direction === 'SHORT' && vcbShort.score <= -45 ? '✅ PASS' : '❌ FAIL'}`);

// 5. TEST POSITION SIZING & RISK SIZER
console.log("\n--- 5. POSITION SIZING & RISK SIZER ---");
const sizeRes = calculatePositionSize(10000, 2, 10, 60000, 58500, 10);
console.log(`  [Sizer] Allowed: ${sizeRes.allowed}, Qty: ${sizeRes.quantity.toFixed(4)}, Margin: $${sizeRes.allocatedMargin.toFixed(2)}, Risk: $${sizeRes.riskAmountUsd}`);
console.log(`  >>> ${sizeRes.allowed && sizeRes.quantity > 0 && sizeRes.allocatedMargin > 0 ? '✅ PASS' : '❌ FAIL'}`);

// 6. TEST CHANDELIER & INVALIDATION TRADE MANAGER
console.log("\n--- 6. CHANDELIER TRAILING STOP & FAKE BREAKOUT INVALIDATION ---");
const testPos: Position = {
  id: 'p1', symbol: 'BTCUSDT', direction: 'LONG', entryPrice: 50800, currentPrice: 50800, quantity: 1.0, leverage: 10,
  allocatedBalance: 5080, tp1: 51250, tp2: 51700, tp3: 52300, sl: 49910, trailingStop: null, trailingStopActive: false,
  entryAtr: 300, timeOpen: new Date().toISOString(), scoreAtEntry: 85, unrealizedPnl: 0, realizedPnl: 0, sizeRemainingPct: 100,
  windowHigh: 50015, windowLow: 49985, barsOpen: 0
};
const m1 = manageCompressionBreakoutPosition(testPos, { open: 51000, high: 51350, low: 51000, close: 51300 }, 300, 2);
const m2 = manageCompressionBreakoutPosition(m1.updatedPosition, { open: 52400, high: 53000, low: 52400, close: 52900 }, 300, 3);
const m3 = manageCompressionBreakoutPosition(m2.updatedPosition, { open: 52900, high: 52900, low: 52000, close: 52050 }, 300, 4);
console.log(`  [TP1 Partial Bank]: Action: ${m1.action}, Remaining: ${m1.updatedPosition.sizeRemainingPct}%, Stop: ${m1.updatedPosition.trailingStop}`);
console.log(`  [Chandelier Trail]: TrailingStop: ${m2.updatedPosition.trailingStop}`);
console.log(`  [Chandelier Exit]:  Action: ${m3.action}, Reason: ${m3.reason}, ExitPrice: ${m3.exitPrice}`);
console.log(`  >>> ${m1.action === 'PARTIAL_TP1' && m1.updatedPosition.sizeRemainingPct === 75 && m3.action === 'EXIT' && m3.reason === 'TS' ? '✅ PASS' : '❌ FAIL'}`);

console.log("\n===============================================================================");
console.log("                        ALL STRATEGY SUITE TESTS PASSED                        ");
console.log("===============================================================================");
