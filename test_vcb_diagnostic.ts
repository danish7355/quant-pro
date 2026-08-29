// Diagnostic: Fetch real Binance data and show VCB gate results per coin
import { runScoringEngine } from './src/utils/indicators';

const COINS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT',
  'SUIUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT', 'PEPEUSDT',
  'SHIBUSDT', 'WIFUSDT', 'FETUSDT', 'RENDERUSDT', 'NEARUSDT'
];

const settings: any = {
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

async function fetchCandles(symbol: string) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=300`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((d: any) => ({
      time: d[0] / 1000,
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch {
    return [];
  }
}

async function diagnose() {
  console.log("=".repeat(120));
  console.log("  VCB LIVE MARKET DIAGNOSTIC — 20 coins on 15m");
  console.log("=".repeat(120));

  for (const symbol of COINS) {
    const candles = await fetchCandles(symbol);
    if (candles.length < 100) { console.log(`${symbol}: SKIP (${candles.length} candles)`); continue; }

    const result = runScoringEngine(candles, settings);
    const gates = result.gates;
    const blockStr = gates.blockReasons?.length > 0 ? gates.blockReasons.join(' | ') : 'none';
    
    console.log(`${symbol.padEnd(14)} Score: ${String(result.score).padStart(4)} | Dir: ${result.direction.padEnd(7)} | Status: ${result.status.padEnd(20)} | Blocks: ${blockStr}`);
  }

  console.log("\n" + "=".repeat(120));
  console.log("  RAW COMPRESSION DATA for all 20 coins");
  console.log("=".repeat(120));
  
  for (const symbol of COINS) {
    const candles = await fetchCandles(symbol);
    if (candles.length < 100) continue;
    
    const idx = candles.length - 1;
    const closes = candles.map((c: any) => c.close);
    const highs = candles.map((c: any) => c.high);
    const lows = candles.map((c: any) => c.low);
    const volumes = candles.map((c: any) => c.volume);

    const tr = Array(idx + 1).fill(0);
    for (let j = 1; j <= idx; j++) {
      tr[j] = Math.max(highs[j] - lows[j], Math.abs(highs[j] - closes[j - 1]), Math.abs(lows[j] - closes[j - 1]));
    }
    const curAtr = tr.slice(idx - 13, idx + 1).reduce((a: number, b: number) => a + b, 0) / 14;
    let atrSum = 0;
    for (let j = idx - 49; j <= idx; j++) {
      const subTr = tr.slice(j - 13, j + 1).reduce((a: number, b: number) => a + b, 0) / 14;
      atrSum += subTr;
    }
    const atrAvg50 = atrSum / 50;
    const boxAtr = tr.slice(Math.max(0, (idx - 1) - 13), idx).reduce((a: number, b: number) => a + b, 0) / 14;
    const atrRatio = boxAtr / (atrAvg50 || 1);
    
    const windowStart = idx - 10;
    let windowHigh = -Infinity, windowLow = Infinity, windowRangeSum = 0, windowVolSum = 0;
    for (let j = windowStart; j <= idx - 1; j++) {
      windowHigh = Math.max(windowHigh, highs[j]);
      windowLow = Math.min(windowLow, lows[j]);
      windowRangeSum += (highs[j] - lows[j]);
      windowVolSum += volumes[j];
    }
    const windowRange = windowHigh - windowLow;
    const windowAvgVol = windowVolSum / 10;
    const curRange = highs[idx] - lows[idx];
    const rangeExp = windowRangeSum / 10 > 0 ? curRange / (windowRangeSum / 10) : 0;
    const volExp = windowAvgVol > 0 ? volumes[idx] / windowAvgVol : 0;
    const brokeUp = closes[idx] > windowHigh;
    const brokeDown = closes[idx] < windowLow;
    
    console.log(`\n${symbol}: ATR_ratio=${atrRatio.toFixed(3)}(≤0.70?${atrRatio<=0.70?'✓':'✗'}) WinRange=${(windowRange/boxAtr).toFixed(1)}ATR(≤3.0?${windowRange<=3.0*boxAtr?'✓':'✗'}) RangeExp=${rangeExp.toFixed(2)}x VolExp=${volExp.toFixed(2)}x BrokeUp=${brokeUp} BrokeDown=${brokeDown}`);
  }
}

diagnose().catch(console.error);
