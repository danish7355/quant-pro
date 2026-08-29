import { runScoringEngine } from './src/utils/indicators';

const baseSettings: any = {
  activeStrategy: 'volatility_compression_breakout',
  timeframe: '15m',
  autoTradeThreshold: 55,
  atrPeriod: 14,
  min24hVolume: 0,
  maxSpread: 10,
  adxTrendThreshold: 10,
  minRRRatio: 1.0,
  accountRiskPct: 1,
  positionSizePct: 10,
  leverage: 10
};

async function getTop100Pairs(): Promise<string[]> {
  try {
    const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    const data: any = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((d: any) => d.symbol.endsWith('USDT'))
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 80)
      .map((d: any) => d.symbol);
  } catch {
    return [];
  }
}

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

async function runAudit() {
  console.log("Fetching top 80 pairs by 24h volume...");
  const symbols = await getTop100Pairs();
  console.log(`Found ${symbols.length} pairs. Scanning on 15m...\n`);

  const results: any[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    // Small delay to be polite to API
    await new Promise(r => setTimeout(r, 100));
    const candles = await fetchCandles(sym);
    if (candles.length < 50) continue;

    // Test VCB
    const vcb = runScoringEngine(candles, { ...baseSettings, activeStrategy: 'volatility_compression_breakout' });
    // Test Climax Reversal
    const climax = runScoringEngine(candles, { ...baseSettings, activeStrategy: 'climax_reversal' });
    // Test V3
    const v3 = runScoringEngine(candles, { ...baseSettings, activeStrategy: 'v3' });

    results.push({
      symbol: sym,
      price: candles[candles.length - 1].close,
      vcb: { score: vcb.score, dir: vcb.direction, status: vcb.status, reason: vcb.reason },
      climax: { score: climax.score, dir: climax.direction, status: climax.status, reason: climax.reason },
      v3: { score: v3.score, dir: v3.direction, status: v3.status, reason: v3.reason }
    });
  }

  console.log("==========================================================================================");
  console.log("                   TOP SCORING BREAKOUTS / SIGNALS IN LIVE MARKET                        ");
  console.log("==========================================================================================");

  // Filter and show active breakout / strong signals
  const activeBreakouts = results.filter(r => Math.abs(r.vcb.score) >= 45 || r.vcb.status === 'BREAKOUT_EXPANSION');
  console.log(`\n>>> VCB BREAKOUTS / STRONG SIGNALS (${activeBreakouts.length} found):`);
  for (const r of activeBreakouts) {
    console.log(`  ${r.symbol.padEnd(12)} | Score: ${String(r.vcb.score).padStart(4)} | Dir: ${r.vcb.dir.padEnd(6)} | Status: ${r.vcb.status.padEnd(20)} | Reason: ${r.vcb.reason}`);
  }

  const activeClimax = results.filter(r => Math.abs(r.climax.score) >= 40);
  console.log(`\n>>> CLIMAX TOP/BOTTOM REVERSALS (${activeClimax.length} found):`);
  for (const r of activeClimax) {
    console.log(`  ${r.symbol.padEnd(12)} | Score: ${String(r.climax.score).padStart(4)} | Dir: ${r.climax.dir.padEnd(6)} | Status: ${r.climax.status.padEnd(20)} | Reason: ${r.climax.reason}`);
  }

  const activeV3 = results.filter(r => Math.abs(r.v3.score) >= 55);
  console.log(`\n>>> V3 SMC REVERSALS / TREND (${activeV3.length} found):`);
  for (const r of activeV3.slice(0, 10)) {
    console.log(`  ${r.symbol.padEnd(12)} | Score: ${String(r.v3.score).padStart(4)} | Dir: ${r.v3.dir.padEnd(6)} | Status: ${r.v3.status.padEnd(20)} | Reason: ${r.v3.reason}`);
  }

  // Top 10 by VCB score
  console.log(`\n>>> TOP 10 COINS BY ABSOLUTE VCB SCORE:`);
  const sortedVcb = [...results].sort((a, b) => Math.abs(b.vcb.score) - Math.abs(a.vcb.score)).slice(0, 10);
  for (const r of sortedVcb) {
    console.log(`  ${r.symbol.padEnd(12)} | VCB: ${String(r.vcb.score).padStart(4)} (${r.vcb.status}) | Climax: ${String(r.climax.score).padStart(4)} | V3: ${String(r.v3.score).padStart(4)}`);
  }
}

runAudit().catch(console.error);
