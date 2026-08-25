import { runScoringEngine } from './src/utils/indicators';
import fetch from 'node-fetch';

async function test() {
  const symbol = 'BTCUSDT';
  const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=500`);
  const klines = await response.json();
  const candles = klines.map((k: any) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));

  const params = {
    adxTrendThreshold: 25,
    slAtrMultiple: 1.5,
    volumeMultiplier: 1.5,
    activeStrategy: 'v2',
    emaFastPeriod: 9,
    emaSlowPeriod: 55,
    emaTrendPeriod: 200,
    atrPeriod: 14,
  };

  const results = runScoringEngine(candles, params);
  console.log('Score:', results.score);
  console.log('Direction:', results.direction);
  console.log('Status:', results.status);
  console.log('Reason:', results.reason);
  console.log('Regime Score:', results.regime.score);
  console.log('Regime Component Scores:', results.regime.componentScores);
}
test();
