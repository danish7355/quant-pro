import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { CoinDetail, Position, TradeLog, AppSettings, EquitySnapshot, Timeframe } from '../types';
import { runScoringEngine } from '../utils/indicators';
import { manageOpenPositionV3, manageCompressionBreakoutPosition } from '../utils/tradeManager';
import { calculatePositionSize } from '../utils/riskManager';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export let stateVersion = 1;
export function bumpStateVersion() {
  stateVersion = (stateVersion + 1) % 10000000;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {}
}

function applyLoadedState(loadedState: any) {
  if (!loadedState) return;
  if (loadedState.settings) {
    state.settings = { ...state.settings, ...loadedState.settings };
  }
  if (typeof loadedState.balance === 'number') {
    state.balance = loadedState.balance;
  }
  if (Array.isArray(loadedState.positions)) {
    state.positions = loadedState.positions;
  }
  if (Array.isArray(loadedState.tradeLogs)) {
    state.tradeLogs = loadedState.tradeLogs;
  }
  if (Array.isArray(loadedState.equitySnapshots)) {
    state.equitySnapshots = loadedState.equitySnapshots;
  }
  if (Array.isArray(loadedState.terminalLogs)) {
    state.terminalLogs = loadedState.terminalLogs;
  }
  bumpStateVersion();
}

// Dual Firebase Cloud & Local Disk State Restoration
export async function loadStateFromFirebase() {
  let loaded = false;

  // 1. Try loading from Firestore first
  if (db) {
    try {
      const docSnap = await getDoc(doc(db, "bot", "state"));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.stateStr) {
          const loadedState = JSON.parse(data.stateStr);
          applyLoadedState(loadedState);
          loaded = true;
          console.log("[ENGINE] State restored from Cloud Firestore.");
        }
      }
    } catch (e) {
      console.error("[ENGINE] Firestore restore error:", e);
    }
  }

  // 2. Fallback to local disk file if not loaded from Firestore
  if (!loaded) {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const fileContent = fs.readFileSync(STATE_FILE, 'utf-8');
        const loadedState = JSON.parse(fileContent);
        applyLoadedState(loadedState);
        console.log("[ENGINE] State restored from local disk backup.");
      }
    } catch(e) {
      console.warn("[ENGINE] No local state file found, using defaults.");
    }
  }
}

let syncTimeout: any = null;
export function scheduleStateSync() {
  bumpStateVersion();
  if (syncTimeout) return;
  syncTimeout = setTimeout(async () => {
    syncTimeout = null;
    const persistentState = {
      settings: state.settings,
      balance: state.balance,
      positions: state.positions,
      tradeLogs: state.tradeLogs.slice(0, 100),
      equitySnapshots: state.equitySnapshots.slice(-100),
      terminalLogs: state.terminalLogs.slice(0, 30)
    };

    // 1. Local disk persistence
    try {
      ensureDataDir();
      fs.writeFileSync(STATE_FILE, JSON.stringify(persistentState, null, 2), 'utf-8');
    } catch(e) {
      console.error("[ENGINE] Failed to save state to local disk:", e);
    }

    // 2. Cloud Firestore persistence
    if (db) {
      try {
        await setDoc(doc(db, "bot", "state"), {
          stateStr: JSON.stringify(persistentState),
          updatedAt: Date.now()
        });
      } catch(e) {
        console.error("[ENGINE] Failed to sync state to Firebase:", e);
      }
    }
  }, 1000);
}

// Global State
export let state = {
  settings: {
    market: 'CRYPTO',
    activeStrategy: 'v2',
    timeframe: '4H' as Timeframe,
    autoTradeThreshold: 60,
    coinCount: 20,
    autoTradeEnabled: true,
    scanInterval: 30,
    theme: 'dark',
    min24hVolume: 100000000,
    maxFundingRate: 0.01,
    maxSpread: 0.5,
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    emaTrendPeriod: 200,
    emaCrossLookback: 5,
    rsiPeriod: 14,
    rsiLongMin: 30,
    rsiLongMax: 60,
    rsiShortMin: 40,
    rsiShortMax: 70,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    adxPeriod: 14,
    adxTrendThreshold: 25,
    superTrendPeriod: 10,
    superTrendMultiplier: 3,
    volumeMultiplier: 1.5,
    fibLookback: 100,
    atrPeriod: 14,
    startingBalance: 1000,
    positionSizePct: 10,
    accountRiskPct: 2,
    leverage: 10,
    maxConcurrentTrades: 3,
    dailyLossLimitPct: 5,
    maxDrawdownPct: 10,
    tp1AtrMultiple: 2,
    tp2AtrMultiple: 3,
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
  } as AppSettings,
  balance: 1000,
  positions: [] as Position[],
  tradeLogs: [] as TradeLog[],
  equitySnapshots: [] as EquitySnapshot[],
  coins: [] as CoinDetail[],
  terminalLogs: [] as string[]
};

export function addTerminalLog(msg: string) {
  state.terminalLogs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (state.terminalLogs.length > 50) state.terminalLogs.pop();
  console.log(`[ENGINE] ${msg}`);
}

async function dispatchTelegramAlert(text: string) {
  if (!state.settings.telegramBotToken || !state.settings.telegramChatId) return;
  try {
    const url = `https://api.telegram.org/bot${state.settings.telegramBotToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: state.settings.telegramChatId, text, parse_mode: 'Markdown' })
    });
  } catch (e) {
    console.error("Telegram error", e);
  }
}

// In-memory cache for top pairs to avoid re-downloading 500KB 24hr ticker on every scan
let cachedTopPairs: { symbol: string; price: number; change24h: number }[] = [];
let lastTopPairsFetch = 0;
const TOP_PAIRS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Dummy fetchers for Node
async function fetchTopFuturesPairs() {
  if (state.settings.market === 'NSE') {
    return [
      { symbol: 'RELIANCE', price: 2950.40, change24h: 1.25 },
      { symbol: 'HDFCBANK', price: 1640.20, change24h: -0.45 },
      { symbol: 'TCS', price: 3890.15, change24h: 0.85 }
    ].slice(0, state.settings.coinCount);
  }
  
  const now = Date.now();
  if (cachedTopPairs.length > 0 && (now - lastTopPairsFetch) < TOP_PAIRS_CACHE_TTL) {
    return cachedTopPairs.slice(0, state.settings.coinCount);
  }

  const endpoints = [
    'https://data-api.binance.vision/api/v3/ticker/24hr',
    'https://fapi.binance.com/fapi/v1/ticker/24hr',
    'https://api.binance.com/api/v3/ticker/24hr',
    'https://api1.binance.com/api/v3/ticker/24hr',
    'https://api2.binance.com/api/v3/ticker/24hr',
    'https://api3.binance.com/api/v3/ticker/24hr'
  ];
  let data: any = null;
  let isMexc = false;

  for (const url of endpoints) {
    try {
      const response = await fetch(url);
      data = await response.json();
      if (Array.isArray(data)) break;
    } catch (e) {
      console.warn(`Failed to fetch from ${url}`);
    }
  }

  // Fallback to Bybit Linear Tickers if Binance fails
  if (!Array.isArray(data)) {
    try {
      const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      const bybitData = await response.json();
      if (Array.isArray(bybitData?.result?.list)) {
        data = bybitData.result.list.map((c: any) => ({
          symbol: c.symbol,
          lastPrice: c.lastPrice,
          priceChangePercent: (parseFloat(c.price24hPcnt || '0') * 100).toString(),
          quoteVolume: c.turnover24h || c.volume24h
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch from Bybit fallback');
    }
  }

  // Fallback to MEXC API
  if (!Array.isArray(data)) {
    console.warn('Binance & Bybit endpoints failed, falling back to MEXC...', data);
    try {
      const response = await fetch('https://api.mexc.com/api/v3/ticker/24hr');
      data = await response.json();
      if (Array.isArray(data)) isMexc = true;
    } catch (e) {
      console.warn('Failed to fetch from MEXC fallback');
    }
  }

  if (!Array.isArray(data)) {
    console.warn('All API endpoints (Binance, Bybit & MEXC) failed or returned non-array');
    return [];
  }

  try {
    cachedTopPairs = data
      .filter((c: any) => c.symbol && c.symbol.endsWith('USDT'))
      .sort((a: any, b: any) => parseFloat(b.quoteVolume || b.volume || 0) - parseFloat(a.quoteVolume || a.volume || 0))
      .map((c: any) => ({
        symbol: c.symbol,
        price: parseFloat(c.lastPrice || c.price || 0),
        change24h: parseFloat(c.priceChangePercent || 0) * (isMexc ? 100 : 1)
      }));
    lastTopPairsFetch = Date.now();
    return cachedTopPairs.slice(0, state.settings.coinCount);
  } catch (e) {
    console.error(e);
    if (cachedTopPairs.length > 0) return cachedTopPairs.slice(0, state.settings.coinCount);
    return [];
  }
}

async function fetchKlines(symbol: string, timeframe: Timeframe) {
  if (state.settings.market === 'NSE') {
    const now = Math.floor(Date.now() / 1000) - 500 * 14400;
    const arr = [];
    let lastPrice = 1000;
    if (symbol === 'RELIANCE') lastPrice = 2950;
    
    let trendCycle = Math.random() * Math.PI * 2;
    for (let i = 0; i < 500; i++) {
      trendCycle += 0.15; 
      const baseTrend = Math.sin(trendCycle) * lastPrice * 0.02; 
      const noise = (Math.random() - 0.5) * lastPrice * 0.015; 
      const change = baseTrend + noise;
      const nextPrice = lastPrice + change;
      
      arr.push({
        time: now + i * 14400,
        open: lastPrice,
        high: Math.max(lastPrice, nextPrice) + Math.abs(noise),
        low: Math.min(lastPrice, nextPrice) - Math.abs(noise),
        close: nextPrice,
        volume: Math.random() * 100000 + 10000,
      });
      lastPrice = nextPrice;
    }
    return arr;
  }

  let binanceTf = timeframe.toLowerCase();
  if (binanceTf === '1h') binanceTf = '1h';
  if (binanceTf === '4h') binanceTf = '4h';
  if (binanceTf === '1d') binanceTf = '1d';
  
  const endpoints = [
    `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${binanceTf}&limit=210`,
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${binanceTf}&limit=210`,
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceTf}&limit=210`,
    `https://api1.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceTf}&limit=210`,
    `https://api2.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceTf}&limit=210`,
    `https://api3.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceTf}&limit=210`
  ];

  let data: any = null;
  for (const url of endpoints) {
    try {
      const response = await fetch(url);
      data = await response.json();
      if (Array.isArray(data)) break;
    } catch (e) {
      console.warn(`Failed to fetch klines from ${url}`);
    }
  }

  if (!Array.isArray(data)) {
    console.warn(`Binance Klines API failed for ${symbol}, falling back to MEXC...`);
    let mexcTf = binanceTf;
    if (mexcTf === '1h') mexcTf = '60m';
    try {
      const response = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${mexcTf}&limit=300`);
      data = await response.json();
    } catch (e) {
      console.warn(`Failed to fetch klines from MEXC fallback for ${symbol}`);
    }
  }

  if (!Array.isArray(data)) {
    console.warn(`All Klines API endpoints failed or returned non-array for ${symbol}:`, data);
    return [];
  }

  try {
    return data.map((d: any) => ({
      time: d[0] / 1000,
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch (e) {
    return [];
  }
}

export async function scanMarkets() {
  addTerminalLog(`Scanning ${state.settings.market} market...`);
  const topCoins = await fetchTopFuturesPairs();
  const updatedCoins: CoinDetail[] = [];

  for (const c of topCoins) {
    // Add small delay to prevent IP bans from burst requests
    await new Promise(r => setTimeout(r, 200));

    const candles = await fetchKlines(c.symbol, state.settings.timeframe);
    if (candles.length < 200) continue;

    const analysis = runScoringEngine(candles, state.settings);
    
    updatedCoins.push({
      symbol: c.symbol,
      price: c.price,
      change24h: c.change24h,
      score: analysis.score,
      direction: analysis.direction as any,
      status: analysis.status as any,
      statusReason: analysis.reason,
      fundingRate: 0.01,
      indicators: analysis.indicators,
      gates: analysis.gates,
      wmPattern: analysis.wmPattern as any,
      candles: candles
    });
  }
  
  state.coins = updatedCoins.sort((a, b) => b.score - a.score);
  processAutoTradingRules(state.coins);
}

function processAutoTradingRules(scannedList: CoinDetail[]) {
  if (!state.settings.autoTradeEnabled) return;
  const openCount = state.positions.length;
  if (openCount >= state.settings.maxConcurrentTrades) return;

  // BUG FIX: SHORT signals have negative scores (e.g. -87).
  // Use Math.abs(score) to evaluate signal strength for both LONG and SHORT.
  const validCandidates = scannedList.filter(c => 
    Math.abs(c.score) >= state.settings.autoTradeThreshold && 
    c.direction !== 'NEUTRAL' &&
    !state.positions.some(p => p.symbol === c.symbol)
  );

  // Sort by absolute score strength (strongest signal first, regardless of direction)
  validCandidates.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  if (validCandidates.length > 0) {
    const topCandidate = validCandidates[0];
    openPosition(topCandidate);
  }
}

function openPosition(coin: CoinDetail) {
  const atr = coin.indicators.atr;
  if (!atr || atr <= 0) {
    addTerminalLog(`⚠️ Skipped ${coin.symbol}: Invalid ATR (${atr})`);
    return;
  }
  const buffer = atr * 0.2; // 0.2 ATR buffer for SL

  let sl: number;
  let tp1: number;
  let tp2: number;
  let tp3: number;

  const supportsBelow = [...new Set(coin.indicators.supportResistance.supports)].filter(s => s < coin.price).sort((a, b) => b - a);
  const resistancesAbove = [...new Set(coin.indicators.supportResistance.resistances)].filter(r => r > coin.price).sort((a, b) => a - b);

  let windowHigh = coin.indicators.compressionState?.windowHigh;
  let windowLow = coin.indicators.compressionState?.windowLow;

  if (state.settings.activeStrategy === 'volatility_compression_breakout' || state.settings.activeStrategy === 'compression_breakout') {
    const effectiveWindowLow = windowLow ?? (coin.price - atr * 1.5);
    const effectiveWindowHigh = windowHigh ?? (coin.price + atr * 1.5);
    if (coin.direction === 'LONG') {
      sl = effectiveWindowLow - 0.3 * atr;
      tp1 = coin.price + 1.5 * atr;
      tp2 = coin.price + 3.0 * atr;
      tp3 = coin.price + 5.0 * atr;
    } else {
      sl = effectiveWindowHigh + 0.3 * atr;
      tp1 = coin.price - 1.5 * atr;
      tp2 = coin.price - 3.0 * atr;
      tp3 = coin.price - 5.0 * atr;
    }
  } else if (coin.direction === 'LONG') {
    const validSupports = supportsBelow.filter(s => s < coin.price - (atr * 0.2));
    sl = validSupports.length > 0 ? validSupports[0] - buffer : coin.price - (atr * state.settings.slAtrMultiple);
    
    const validResistances = resistancesAbove.filter(r => r > coin.price + (atr * 0.2));
    tp1 = validResistances.length > 0 ? validResistances[0] : coin.price + (atr * state.settings.tp1AtrMultiple);
    tp2 = validResistances.length > 1 ? validResistances[1] : (tp1 + atr * 2);
    tp3 = validResistances.length > 2 ? validResistances[2] : (tp2 + atr * 2);
  } else {
    const validResistances = resistancesAbove.filter(r => r > coin.price + (atr * 0.2));
    sl = validResistances.length > 0 ? validResistances[0] + buffer : coin.price + (atr * state.settings.slAtrMultiple);
    
    const validSupports = supportsBelow.filter(s => s < coin.price - (atr * 0.2));
    tp1 = validSupports.length > 0 ? validSupports[0] : coin.price - (atr * state.settings.tp1AtrMultiple);
    tp2 = validSupports.length > 1 ? validSupports[1] : (tp1 - atr * 2);
    tp3 = validSupports.length > 2 ? validSupports[2] : (tp2 - atr * 2);
  }

  const slDist = Math.abs(coin.price - sl);
  if (slDist <= 0) {
    addTerminalLog(`⚠️ Skipped ${coin.symbol}: SL distance is 0`);
    return;
  }

  // Validate minimum Risk:Reward ratio
  const tp1Dist = Math.abs(tp1 - coin.price);
  const rrRatio = tp1Dist / slDist;
  if (state.settings.minRRRatio > 0 && rrRatio < state.settings.minRRRatio) {
    addTerminalLog(`⚠️ Skipped ${coin.symbol}: R:R ${rrRatio.toFixed(2)} < min ${state.settings.minRRRatio}`);
    return;
  }

  const currentTotalExposureUsd = state.positions.reduce((sum, p) => sum + p.allocatedBalance, 0);
  const sizeRes = calculatePositionSize(
    state.balance,
    state.settings.accountRiskPct,
    state.settings.positionSizePct || 10,
    coin.price,
    sl,
    state.settings.leverage,
    20,
    80,
    currentTotalExposureUsd
  );

  if (!sizeRes.allowed || sizeRes.quantity <= 0) {
    addTerminalLog(`⚠️ Skipped ${coin.symbol}: ${sizeRes.reason || 'Position sizing rejected'}`);
    return;
  }

  const qty = sizeRes.quantity;
  const allocatedBalance = sizeRes.allocatedMargin;

  const newPos: Position = {
    id: Math.random().toString(36).substr(2, 9),
    symbol: coin.symbol,
    direction: coin.direction as 'LONG'|'SHORT',
    entryPrice: coin.price,
    currentPrice: coin.price,
    quantity: qty,
    leverage: state.settings.leverage,
    allocatedBalance,
    tp1, tp2, tp3, sl,
    trailingStop: null,
    trailingStopActive: false,
    entryAtr: atr,
    timeOpen: new Date().toISOString(),
    scoreAtEntry: coin.score,
    maxProfitablePrice: coin.price,
    unrealizedPnl: 0,
    realizedPnl: 0,
    sizeRemainingPct: 100,
    windowHigh,
    windowLow,
    barsOpen: 0
  };

  state.positions.push(newPos);
  state.balance -= allocatedBalance;
  scheduleStateSync();
  addTerminalLog(`Opened ${coin.direction} on ${coin.symbol} at ${coin.price} | SL: ${sl.toFixed(4)} | TP1: ${tp1.toFixed(4)} | R:R: ${rrRatio.toFixed(2)} | Margin: $${allocatedBalance.toFixed(2)}`);
  if (state.settings.alertOnTradeExecuted) {
    dispatchTelegramAlert(`🚨 *NEW TRADE EXECUTED*\nSymbol: ${coin.symbol}\nDirection: ${coin.direction}\nEntry: ${coin.price.toFixed(4)}\nSL: ${sl.toFixed(4)}\nTP1: ${tp1.toFixed(4)}`);
  }
}

export function closeManualPosition(id: string) {
  const pos = state.positions.find(p => p.id === id);
  if (!pos) return;
  closePosition(pos, 'MANUAL');
}

export function closePartialPosition(pos: Position, reason: TradeLog["exitReason"], partialRatio: number) {
  const idx = state.positions.findIndex(p => p.id === pos.id);
  if (idx === -1) return;
  const pnl = pos.unrealizedPnl * partialRatio;
  const marginFreed = pos.allocatedBalance * partialRatio;
  state.balance += (marginFreed + pnl);
  
  const log: TradeLog = {
    id: Math.random().toString(36).substr(2, 9),
    symbol: pos.symbol,
    direction: pos.direction,
    entryPrice: pos.entryPrice,
    closePrice: pos.currentPrice,
    leverage: pos.leverage,
    profit: pnl,
    pctReturn: (pnl / marginFreed) * 100,
    exitReason: reason,
    timeOpen: pos.timeOpen,
    timeClose: new Date().toISOString(),
    scoreAtEntry: pos.scoreAtEntry,
    scoreAtClose: 0
  };
  state.tradeLogs.unshift(log);
  if (state.tradeLogs.length > 500) state.tradeLogs.pop();
  scheduleStateSync();
    if (state.tradeLogs.length > 500) state.tradeLogs.pop();
  state.equitySnapshots.push({ time: new Date().toISOString(), balance: state.balance });
  scheduleStateSync();
  addTerminalLog(`🔸 PARTIAL CLOSED ${pos.symbol} [${reason}] PNL: $${pnl.toFixed(2)}`);
}

export function closePosition(pos: Position, reason: TradeLog['exitReason']) {
  const idx = state.positions.findIndex(p => p.id === pos.id);
  if (idx === -1) return;
  
  state.positions.splice(idx, 1);
  const profit = pos.unrealizedPnl;
  state.balance += (pos.allocatedBalance + profit);

  const log: TradeLog = {
    id: Math.random().toString(36).substr(2, 9),
    symbol: pos.symbol,
    direction: pos.direction,
    entryPrice: pos.entryPrice,
    closePrice: pos.currentPrice,
    leverage: pos.leverage,
    profit,
    pctReturn: (profit / pos.allocatedBalance) * 100,
    exitReason: reason,
    timeOpen: pos.timeOpen,
    timeClose: new Date().toISOString(),
    scoreAtEntry: pos.scoreAtEntry,
    scoreAtClose: 0
  };
  state.tradeLogs.unshift(log);
  state.equitySnapshots.push({ time: new Date().toISOString(), balance: state.balance });
  scheduleStateSync();
  addTerminalLog(`🔴 CLOSED ${pos.symbol} [${reason}] PNL: $${profit.toFixed(2)}`);
  
  if (state.settings.alertOnTpHit && reason.includes('TP')) {
    dispatchTelegramAlert(`✅ *TAKE PROFIT HIT*\nSymbol: ${pos.symbol}\nReason: ${reason}\nProfit: $${profit.toFixed(2)}`);
  } else if (state.settings.alertOnSlHit && (reason === 'SL' || reason === 'TS')) {
    dispatchTelegramAlert(`🛑 *STOP LOSS HIT*\nSymbol: ${pos.symbol}\nReason: ${reason}\nLoss: $${profit.toFixed(2)}`);
  }
}

// Multi-Exchange Fallback Feed Engine
let ws: WebSocket | null = null;
let nseInterval: any = null;
let reconnectTimeout: any = null;
let watchdogInterval: any = null;
let fallbackRestInterval: any = null;
let lastTickTimestamp: number = Date.now();
let currentWsIndex = 0;

const WS_FEED_ENDPOINTS = [
  { name: 'Binance Futures WS', url: 'wss://fstream.binance.com/ws/!miniTicker@arr' },
  { name: 'Binance Spot Vision WS', url: 'wss://data-stream.binance.vision/ws/!miniTicker@arr' },
  { name: 'Binance Spot Public WS', url: 'wss://stream.binance.com/ws/!miniTicker@arr' }
];

export async function fetchFallbackTickers(): Promise<{ symbol: string; price: number }[]> {
  // 1. Try Binance Futures REST
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({ symbol: d.symbol, price: parseFloat(d.price) }));
    }
  } catch (e) {}

  // 2. Try Binance Spot REST
  try {
    const res = await fetch("https://data-api.binance.vision/api/v3/ticker/price", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({ symbol: d.symbol, price: parseFloat(d.price) }));
    }
  } catch (e) {}

  // 3. Try Bybit Linear REST
  try {
    const res = await fetch("https://api.bybit.com/v5/market/tickers?category=linear", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const list = data?.result?.list;
    if (Array.isArray(list) && list.length > 0) {
      return list.map((d: any) => ({ symbol: d.symbol, price: parseFloat(d.lastPrice) }));
    }
  } catch (e) {}

  // 4. Try MEXC REST
  try {
    const res = await fetch("https://api.mexc.com/api/v3/ticker/price", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({ symbol: d.symbol, price: parseFloat(d.price) }));
    }
  } catch (e) {}

  // 5. Try Gate.io REST
  try {
    const res = await fetch("https://api.gateio.ws/api/v4/spot/tickers", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({ symbol: (d.currency_pair || '').replace('_', ''), price: parseFloat(d.last) }));
    }
  } catch (e) {}

  return [];
}

export function handlePriceUpdate(tickers: { symbol: string; price: number }[]) {
  if (!Array.isArray(tickers) || tickers.length === 0) return;
  lastTickTimestamp = Date.now();

  const currentPositions = [...state.positions];
  let positionModified = false;

  currentPositions.forEach(p => {
    const ticker = tickers.find(t => t.symbol === p.symbol);
    if (!ticker || isNaN(ticker.price) || ticker.price <= 0) return;

    const currentPrice = ticker.price;
    const isLong = p.direction === 'LONG';
    let closedReason: TradeLog['exitReason'] | null = null;
    const pnl = isLong ? (currentPrice - p.entryPrice) * p.quantity : (p.entryPrice - currentPrice) * p.quantity;

    if (state.settings.activeStrategy === 'volatility_compression_breakout' || state.settings.activeStrategy === 'compression_breakout') {
      const result = manageCompressionBreakoutPosition(
        p,
        { open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice },
        p.entryAtr || currentPrice * 0.02,
        p.barsOpen || 0
      );

      if (result.action === 'EXIT') {
        closePosition({ ...p, currentPrice, unrealizedPnl: pnl }, result.reason as any);
        positionModified = true;
      } else if (result.action.startsWith('PARTIAL') && result.partialRatio) {
        closePartialPosition({ ...p, currentPrice, unrealizedPnl: pnl }, result.reason as any, result.partialRatio);
        positionModified = true;

        const idx = state.positions.findIndex(pos => pos.id === p.id);
        if (idx !== -1) {
          const shrinkRatio = result.updatedPosition.sizeRemainingPct / state.positions[idx].sizeRemainingPct;
          state.positions[idx].quantity *= shrinkRatio;
          state.positions[idx].allocatedBalance *= shrinkRatio;
          state.positions[idx].sizeRemainingPct = result.updatedPosition.sizeRemainingPct;
          state.positions[idx].initialTpHit = true;
        }
      }

      const idx = state.positions.findIndex(pos => pos.id === p.id);
      if (idx !== -1 && result.action !== 'EXIT') {
        state.positions[idx].currentPrice = currentPrice;
        state.positions[idx].unrealizedPnl = isLong ? (currentPrice - state.positions[idx].entryPrice) * state.positions[idx].quantity : (state.positions[idx].entryPrice - currentPrice) * state.positions[idx].quantity;
        state.positions[idx].maxProfitablePrice = result.updatedPosition.maxProfitablePrice;
        state.positions[idx].trailingStop = result.updatedPosition.trailingStop;
        state.positions[idx].trailingStopActive = result.updatedPosition.trailingStopActive;
        state.positions[idx].barsOpen = result.updatedPosition.barsOpen;
      }
      return;
    }

    if (state.settings.activeStrategy === 'v3' || state.settings.activeStrategy === 'climax_reversal') {
      const timeOpen = new Date(p.timeOpen).getTime();
      const elapsedHours = (Date.now() - timeOpen) / (1000 * 60 * 60);
      const result = manageOpenPositionV3(
        p,
        { open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice },
        p.entryAtr,
        elapsedHours,
        state.settings.timeBasedExitCandles
      );

      if (result.action === 'EXIT') {
        closePosition({ ...p, currentPrice, unrealizedPnl: pnl }, result.reason as any);
        positionModified = true;
      } else if (result.action.startsWith('PARTIAL') && result.partialRatio) {
        closePartialPosition({ ...p, currentPrice, unrealizedPnl: pnl }, result.reason as any, result.partialRatio);
        positionModified = true;

        const idx = state.positions.findIndex(pos => pos.id === p.id);
        if (idx !== -1) {
          const shrinkRatio = result.updatedPosition.sizeRemainingPct / state.positions[idx].sizeRemainingPct;
          state.positions[idx].quantity *= shrinkRatio;
          state.positions[idx].allocatedBalance *= shrinkRatio;
          state.positions[idx].sizeRemainingPct = result.updatedPosition.sizeRemainingPct;
        }
      }

      const idx = state.positions.findIndex(pos => pos.id === p.id);
      if (idx !== -1 && result.action !== 'EXIT') {
        state.positions[idx].currentPrice = currentPrice;
        state.positions[idx].unrealizedPnl = isLong ? (currentPrice - state.positions[idx].entryPrice) * state.positions[idx].quantity : (state.positions[idx].entryPrice - currentPrice) * state.positions[idx].quantity;
        state.positions[idx].maxProfitablePrice = result.updatedPosition.maxProfitablePrice;
        state.positions[idx].trailingStop = result.updatedPosition.trailingStop;
        state.positions[idx].trailingStopActive = result.updatedPosition.trailingStopActive;
      }
      return;
    }

    // Original V2 SMC logic with Trailing Stop
    let newMaxProfitable = p.maxProfitablePrice || p.entryPrice;
    if (isLong) {
      if (currentPrice > newMaxProfitable) newMaxProfitable = currentPrice;
    } else {
      if (currentPrice < newMaxProfitable) newMaxProfitable = currentPrice;
    }

    let newTrailingStop = p.trailingStop || p.sl;
    let trailingStopActive = p.trailingStopActive || false;

    const hitTp1ForTrail = isLong ? (newMaxProfitable >= p.tp1) : (newMaxProfitable <= p.tp1);
    const hitTp2ForTrail = isLong ? (newMaxProfitable >= p.tp2) : (newMaxProfitable <= p.tp2);

    if (hitTp2ForTrail) {
      newTrailingStop = p.tp1;
      trailingStopActive = true;
    } else if (hitTp1ForTrail) {
      newTrailingStop = p.entryPrice;
      trailingStopActive = true;
    }

    const currentStop = newTrailingStop;

    if (isLong) {
      if (currentPrice <= currentStop) closedReason = trailingStopActive ? 'TS' as any : 'SL';
      else if (currentPrice >= p.tp3) closedReason = 'TP3';
    } else {
      if (currentPrice >= currentStop) closedReason = trailingStopActive ? 'TS' as any : 'SL';
      else if (currentPrice <= p.tp3) closedReason = 'TP3';
    }

    if (closedReason) {
      closePosition({ ...p, currentPrice, unrealizedPnl: pnl }, closedReason);
      positionModified = true;
    } else {
      const idx = state.positions.findIndex(pos => pos.id === p.id);
      if (idx !== -1) {
        state.positions[idx].currentPrice = currentPrice;
        state.positions[idx].unrealizedPnl = pnl;
        state.positions[idx].maxProfitablePrice = newMaxProfitable;
        state.positions[idx].trailingStop = newTrailingStop;
        state.positions[idx].trailingStopActive = trailingStopActive;
      }
    }
  });

  // Update coins list prices in real time
  state.coins.forEach(c => {
    const ticker = tickers.find(t => t.symbol === c.symbol);
    if (ticker && !isNaN(ticker.price) && ticker.price > 0) {
      c.price = ticker.price;
    }
  });

  if (positionModified) {
    bumpStateVersion();
  }
}

function connectWS() {
  if (state.settings.market === 'NSE') {
    nseInterval = setInterval(() => {
      const data = state.positions.map(p => ({
        symbol: p.symbol,
        price: p.currentPrice * (1 + (Math.random() * 0.002 - 0.001))
      }));
      handlePriceUpdate(data);
    }, 3000);
    return;
  }

  const activeSource = WS_FEED_ENDPOINTS[currentWsIndex];

  try {
    if (ws) {
      ws.removeAllListeners();
      try { ws.close(); } catch(e) {}
      ws = null;
    }

    ws = new WebSocket(activeSource.url);

    ws.on('open', () => {
      lastTickTimestamp = Date.now();
    });

    ws.on('message', (message) => {
      try {
        const raw = JSON.parse(message.toString());
        if (Array.isArray(raw)) {
          const tickers = raw.map((d: any) => ({
            symbol: d.s,
            price: parseFloat(d.c)
          }));
          handlePriceUpdate(tickers);
        }
      } catch (e) {}
    });

    ws.on('error', () => {
      rotateFeed();
    });

    ws.on('close', () => {
      rotateFeed();
    });
  } catch (e) {
    rotateFeed();
  }
}

function rotateFeed() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  currentWsIndex = (currentWsIndex + 1) % WS_FEED_ENDPOINTS.length;
  reconnectTimeout = setTimeout(connectWS, 2000);
}

function startWatchdogAndFallback() {
  if (watchdogInterval) clearInterval(watchdogInterval);
  if (fallbackRestInterval) clearInterval(fallbackRestInterval);

  // Watchdog checks every 2.5 seconds if price stream is stale (> 4s without ticks)
  watchdogInterval = setInterval(async () => {
    const timeSinceLastTick = Date.now() - lastTickTimestamp;
    if (timeSinceLastTick > 4000) {
      const fallbackTickers = await fetchFallbackTickers();
      if (fallbackTickers.length > 0) {
        handlePriceUpdate(fallbackTickers);
      }
      
      // If stale for more than 8 seconds, rotate WebSocket to next exchange
      if (timeSinceLastTick > 8000) {
        rotateFeed();
      }
    }
  }, 2500);

  // Continuous fallback REST poller: guarantees positions and prices update 24/7
  fallbackRestInterval = setInterval(async () => {
    if (state.positions.length > 0 && (Date.now() - lastTickTimestamp > 2000)) {
      const tickers = await fetchFallbackTickers();
      if (tickers.length > 0) {
        handlePriceUpdate(tickers);
      }
    }
  }, 3000);
}

function stopWatchdogAndFallback() {
  if (watchdogInterval) clearInterval(watchdogInterval);
  if (fallbackRestInterval) clearInterval(fallbackRestInterval);
  watchdogInterval = null;
  fallbackRestInterval = null;
}

let engineInterval: any = null;
export function startEngine() {
  if (engineInterval) return;
  scanMarkets();
  engineInterval = setInterval(scanMarkets, state.settings.scanInterval * 1000);
  addTerminalLog("Engine started");
  if (!ws && !nseInterval) connectWS();
  startWatchdogAndFallback();
}

export function stopEngine() {
  if (engineInterval) clearInterval(engineInterval);
  engineInterval = null;
  addTerminalLog("Engine stopped");
  if (ws) {
    ws.close();
    ws = null;
  }
  if (nseInterval) {
    clearInterval(nseInterval);
    nseInterval = null;
  }
  stopWatchdogAndFallback();
}

