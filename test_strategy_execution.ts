import { runScoringEngine } from './src/utils/indicators';
import { manageOpenPositionV3, defaultV3Config } from './src/utils/tradeManager';
import { calculatePositionSize } from './src/utils/riskManager';
import { Position, AppSettings, CoinDetail } from './src/types';

console.log('=====================================================');
console.log('--- COMPREHENSIVE STRATEGY & EXECUTION AUDIT TEST ---');
console.log('=====================================================\n');

// 1. Generate test candles
function generateTrendCandles(type: 'BULLISH' | 'BEARISH' | 'RANGING', count = 250) {
  const candles = [];
  let price = 100;
  const baseTime = Math.floor(Date.now() / 1000) - count * 3600;

  for (let i = 0; i < count; i++) {
    let drift = 0;
    if (type === 'BULLISH') drift = 0.25; // steady uptrend
    else if (type === 'BEARISH') drift = -0.25; // steady downtrend
    else drift = (Math.random() - 0.5) * 0.4; // choppy

    const noise = (Math.random() - 0.5) * 0.3;
    const open = price;
    const close = price + drift + noise;
    const high = Math.max(open, close) + Math.random() * 0.4;
    const low = Math.min(open, close) - Math.random() * 0.4;
    const volume = 50000 + Math.random() * 20000;

    candles.push({
      time: baseTime + i * 3600,
      open, high, low, close, volume
    });
    price = close;
  }
  return candles;
}

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

// TEST 1: Strategy V2 Scoring Engine
console.log('--- TEST 1: Strategy V2 (SMC Trend Scoring) ---');
const bullCandles = generateTrendCandles('BULLISH');
const bearCandles = generateTrendCandles('BEARISH');
const rangeCandles = generateTrendCandles('RANGING');

const bullRes = runScoringEngine(bullCandles, { ...baseSettings, activeStrategy: 'v2' });
console.log(`[Bullish Market] Direction: ${bullRes.direction}, Score: ${bullRes.score}, Status: ${bullRes.status}, Reason: ${bullRes.reason}`);

const bearRes = runScoringEngine(bearCandles, { ...baseSettings, activeStrategy: 'v2' });
console.log(`[Bearish Market] Direction: ${bearRes.direction}, Score: ${bearRes.score}, Status: ${bearRes.status}, Reason: ${bearRes.reason}`);

const rangeRes = runScoringEngine(rangeCandles, { ...baseSettings, activeStrategy: 'v2' });
console.log(`[Ranging Market] Direction: ${rangeRes.direction}, Score: ${rangeRes.score}, Status: ${rangeRes.status}, Reason: ${rangeRes.reason}`);

// TEST 2: Strategy V3 Scoring Engine
console.log('\n--- TEST 2: Strategy V3 (EMA/BB Reversals) ---');
const v3Res = runScoringEngine(bullCandles, { ...baseSettings, activeStrategy: 'v3' });
console.log(`[V3 Test] Direction: ${v3Res.direction}, Score: ${v3Res.score}, Status: ${v3Res.status}`);

// TEST 3: Strategy Climax Reversal
console.log('\n--- TEST 3: Strategy Climax Reversal ---');
const climaxRes = runScoringEngine(bullCandles, { ...baseSettings, activeStrategy: 'climax_reversal' });
console.log(`[Climax Test] Direction: ${climaxRes.direction}, Score: ${climaxRes.score}, Status: ${climaxRes.status}, Reason: ${climaxRes.reason}`);

// TEST 4: Trade Manager & Trailing Stop Execution Lifecycle
console.log('\n--- TEST 4: Trade Lifecycle & Trailing Stop Execution ---');
const testPos: Position = {
  id: 'pos_test_1',
  symbol: 'BTCUSDT',
  direction: 'LONG',
  entryPrice: 60000,
  currentPrice: 60000,
  quantity: 1,
  leverage: 10,
  allocatedBalance: 6000,
  tp1: 62000,
  tp2: 64000,
  tp3: 68000,
  sl: 58500,
  trailingStop: null,
  trailingStopActive: false,
  entryAtr: 1000,
  timeOpen: new Date().toISOString(),
  scoreAtEntry: 85,
  maxProfitablePrice: 60000,
  unrealizedPnl: 0,
  realizedPnl: 0,
  sizeRemainingPct: 100
};

// Tick 1: Price goes up to 61,000 (no TP yet)
const r1 = manageOpenPositionV3(testPos, { open: 61000, high: 61000, low: 61000, close: 61000 }, 1000, 1, 24);
console.log(`[Tick 1 @ 61,000] Action: ${r1.action}, TrailingStop: ${r1.updatedPosition.trailingStop}, TS Active: ${r1.updatedPosition.trailingStopActive}`);

// Tick 2: Price reaches TP1 (62,000) -> should trigger PARTIAL_TP1 and move TrailingStop to EntryPrice (60,000)
const r2 = manageOpenPositionV3(r1.updatedPosition, { open: 62000, high: 62000, low: 62000, close: 62000 }, 1000, 2, 24);
console.log(`[Tick 2 @ 62,000 TP1] Action: ${r2.action}, Ratio: ${r2.partialRatio}, SizeLeft: ${r2.updatedPosition.sizeRemainingPct}%, TrailingStop: ${r2.updatedPosition.trailingStop}`);

// Tick 3: Price reaches TP2 (64,000) -> should trigger PARTIAL_TP2 and move TrailingStop to TP1 (62,000)
const r3 = manageOpenPositionV3(r2.updatedPosition, { open: 64000, high: 64000, low: 64000, close: 64000 }, 1000, 3, 24);
console.log(`[Tick 3 @ 64,000 TP2] Action: ${r3.action}, Ratio: ${r3.partialRatio?.toFixed(2)}, SizeLeft: ${r3.updatedPosition.sizeRemainingPct}%, TrailingStop: ${r3.updatedPosition.trailingStop}`);

// Tick 4: Price drops back to 62,000 (hitting the TrailingStop at TP1) -> should trigger EXIT (TS)
const r4 = manageOpenPositionV3(r3.updatedPosition, { open: 62000, high: 62000, low: 61990, close: 61990 }, 1000, 4, 24);
console.log(`[Tick 4 @ 61,990 Pullback] Action: ${r4.action}, ExitPrice: ${r4.exitPrice}, Reason: ${r4.reason}`);

// TEST 5: Position Sizing & Risk Management
console.log('\n--- TEST 5: Position Sizing & Risk Calculation ---');
const sizeTest = calculatePositionSize(10000, 2, 10, 60000, 58500, 10);
console.log(`[Size Calculation] Allowed: ${sizeTest.allowed}, Qty: ${sizeTest.quantity.toFixed(4)}, Margin: $${sizeTest.allocatedMargin.toFixed(2)}, Risk: $${sizeTest.riskAmountUsd}`);

console.log('\n=====================================================');
console.log('--- ALL STRATEGY & EXECUTION TESTS COMPLETED ---');
console.log('=====================================================');
