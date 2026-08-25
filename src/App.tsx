/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, TrendingDown, LayoutDashboard, Settings as SettingsIcon, LineChart, History, ShieldAlert, Terminal,
  CircleCheck, ChevronRight, RefreshCw, Bell, Sun, Moon, Play, Square, Search, Activity, BarChart2, List, GitPullRequest, Zap, Menu, X
} from 'lucide-react';

import { auth, loginWithGoogle, logout, saveSettingsToDB, saveStateToDB, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Timeframe, CoinDetail, Position, TradeLog, AppSettings, EquitySnapshot } from './types';
import ScannerList from './components/ScannerList';
import SettingsPanel from './components/SettingsPanel';
import ActiveTrades from './components/ActiveTrades';
import TradingChart from './components/TradingChart';
import PerformancePage from './components/PerformancePage';
import BacktestLab from './components/BacktestLab';
import StrategyLab from './components/StrategyLab';
import RiskCenter from './components/RiskCenter';
import { runScoringEngine } from './utils/indicators';
import { manageOpenPositionV3 } from './utils/tradeManager';


// Default initial settings
const INITIAL_SETTINGS: AppSettings = {
  market: 'CRYPTO',
  activeStrategy: 'v2',
  timeframe: '4H',
  autoTradeThreshold: 60, // Minimum Score for Trade 60 instead of 65
  coinCount: 20,
  autoTradeEnabled: true,
  scanInterval: 300, // 5 minutes default
  theme: 'dark',

  min24hVolume: 10000000,
  maxFundingRate: 0.15,
  maxSpread: 0.3,

  emaFastPeriod: 9,
  emaSlowPeriod: 55,
  emaTrendPeriod: 200,
  emaCrossLookback: 3,

  rsiPeriod: 14,
  rsiLongMin: 30,
  rsiLongMax: 65,
  rsiShortMin: 30,
  rsiShortMax: 55,

  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  adxPeriod: 14,
  adxTrendThreshold: 20,
  superTrendPeriod: 10,
  superTrendMultiplier: 3.0,
  volumeMultiplier: 1.5,
  fibLookback: 100,

  atrPeriod: 14,

  startingBalance: 10000,
  positionSizePct: 10, // user wants to use only 10%
  accountRiskPct: 1,
  leverage: 1, // user said: "i don't want to use leverage" -> means 1x leverage
  maxConcurrentTrades: 10,
  dailyLossLimitPct: 3,
  maxDrawdownPct: 10,

  tp1AtrMultiple: 2.0, // ATR Take Profit
  tp2AtrMultiple: 3.5,
  tp3FibLevel: 1.618,
  slAtrMultiple: 1.5, // ATR Stop Loss
  minRRRatio: 1.5,

  trailingStopActivation: 'TP1',
  trailActivationR: 1,
  timeBasedExitEnabled: true,
  timeBasedExitCandles: 3,

  telegramBotToken: '',
  telegramChatId: '',
  alertOnNewSignal: true,
  alertOnTradeExecuted: true,
  alertOnTpHit: true,
  alertOnSlHit: true,
  alertOnTsMoved: true,
  alertOnDailyLossLimit: true,
  alertOnRangingDetected: false,
};

// Check local storage for initial values
const safeGetLocal = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`LocalStorage blocked or failed for ${key}`, e);
    return null;
  }
};

const safeSetLocal = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`LocalStorage blocked or failed for ${key}`, e);
  }
};

const getInitialSettings = (): AppSettings => {
  const local = safeGetLocal('bt_app_settings');
  if (local) { try { return { ...INITIAL_SETTINGS, ...JSON.parse(local) }; } catch (e) {} }
  return INITIAL_SETTINGS;
};

const getInitialBalance = (): number => {
  const local = safeGetLocal('bt_demo_balance');
  if (local) {
    const parsed = parseFloat(local);
    if (!isNaN(parsed)) return parsed;
  }
  return 10000;
};

const getInitialPositions = (): Position[] => {
  const local = safeGetLocal('bt_positions');
  if (local) { 
    try { 
      const parsed = JSON.parse(local) || [];
      const unique = [];
      const seen = new Set();
      for (const pos of parsed) {
        if (!seen.has(pos.id)) {
          seen.add(pos.id);
          unique.push(pos);
        }
      }
      return unique;
    } catch (e) {} 
  }
  return [];
};

const getInitialTradeLogs = (): TradeLog[] => {
  const local = safeGetLocal('bt_trade_logs');
  if (local) { 
    try { 
      const parsed = JSON.parse(local) || [];
      // Deduplicate by ID in case of strict-mode double closures from previous bugs
      const unique = [];
      const seen = new Set();
      for (const log of parsed) {
        if (!seen.has(log.id)) {
          seen.add(log.id);
          unique.push(log);
        }
      }
      return unique;
    } catch (e) {} 
  }
  return [];
};

const getInitialEquitySnapshots = (): EquitySnapshot[] => {
  const local = safeGetLocal('bt_equity_snapshots');
  if (local) { try { return JSON.parse(local) || []; } catch (e) {} }
  return [];
};

export default function App() {

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Global State from Server
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [equitySnapshots, setEquitySnapshots] = useState<EquitySnapshot[]>([]);
  const [coins, setCoins] = useState<CoinDetail[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  
  const [selectedSymbol, setSelectedSymbol] = useState<'BTCUSDT' | string>('BTCUSDT');
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>('CONNECTING');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(u => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectDirectWS = () => {
      try {
        ws = new WebSocket('wss://stream.binance.com/ws/!miniTicker@arr');
        ws.onmessage = (event) => {
          try {
            const tickers = JSON.parse(event.data);
            if (Array.isArray(tickers)) {
              // Update coins list prices in real time
              setCoins(prevCoins => {
                let changed = false;
                const updated = prevCoins.map(coin => {
                  const t = tickers.find((item: any) => item.s === coin.symbol);
                  if (t) {
                    const newPrice = parseFloat(t.c);
                    if (newPrice !== coin.price) {
                      changed = true;
                      return { ...coin, price: newPrice };
                    }
                  }
                  return coin;
                });
                return changed ? updated : prevCoins;
              });

              // Update open position prices & unrealized PnL in real time
              setPositions(prevPositions => {
                let changed = false;
                const updated = prevPositions.map(pos => {
                  const t = tickers.find((item: any) => item.s === pos.symbol);
                  if (t) {
                    const newPrice = parseFloat(t.c);
                    if (newPrice !== pos.currentPrice) {
                      changed = true;
                      const isLong = pos.direction === 'LONG';
                      const pnl = isLong ? (newPrice - pos.entryPrice) * pos.quantity : (pos.entryPrice - newPrice) * pos.quantity;
                      return { ...pos, currentPrice: newPrice, unrealizedPnl: pnl };
                    }
                  }
                  return pos;
                });
                return changed ? updated : prevPositions;
              });
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connectDirectWS, 5000);
        };
        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (e) {}
    };

    connectDirectWS();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    const fetchState = async () => {
      // Pause polling if the tab is in background to save Render bandwidth
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await fetch(`/api/state?activeCoin=${selectedSymbol}`);
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
          setBalance(data.balance);
          setPositions(data.positions);
          setTradeLogs(data.tradeLogs);
          setEquitySnapshots(data.equitySnapshots);
          setCoins(data.coins);
          setTerminalLogs(data.terminalLogs);
          setConnectionStatus('CONNECTED');
        } else {
          setConnectionStatus('DISCONNECTED');
        }
      } catch (e) {
        setConnectionStatus('DISCONNECTED');
      }
    };
    
    fetchState();
    // 15-second background sync interval (saving 80% Render bandwidth)
    const interval = setInterval(fetchState, 15000);

    // Refresh immediately when window gains focus
    const handleFocus = () => fetchState();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [selectedSymbol]);

  const handleManualClose = async (id: string) => {
    try {
      await fetch('/api/engine/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualCloseAll = async () => {
    for (const p of positions) {
      await handleManualClose(p.id);
    }
  };

  const updateSettings = async (newSettings: AppSettings) => {
    try {
       await fetch('/api/settings', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(newSettings)
       });
       setSettings(newSettings);
    } catch (e) {
       console.error(e);
    }
  };

  const handleResetBalance = () => {};
  const handleResetSettings = () => {};

  if (!settings) {
    return <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">Connecting to Engine...</div>;
  }
  
  const currentCoinDetail = coins.find(c => c.symbol === selectedSymbol) || coins[0];
  const totalAccountValue = balance + positions.reduce((acc, p) => acc + p.allocatedBalance + p.unrealizedPnl, 0);

  const TABS = [
    { id: 'dashboard', label: '1. Dashboard', icon: LayoutDashboard },
    { id: 'scanner', label: '2. Scanner', icon: List },
    { id: 'positions', label: '3. Trade Manager', icon: Activity },
    { id: 'backtest', label: '4. Backtest Engine', icon: LineChart },
    { id: 'history', label: '5. Analytics', icon: History },
    { id: 'strategy_lab', label: '6. Strategy Lab', icon: GitPullRequest },
    { id: 'risk_center', label: '7. Risk Center', icon: ShieldAlert },
    { id: 'settings', label: '8. Settings', icon: SettingsIcon },
    { id: 'logs', label: '9. Terminal Logs', icon: Terminal },
  ];

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#05080f] border-b border-[#30363D] relative z-20">
        <div className="flex items-center gap-2">
           <Zap className="w-5 h-5 text-indigo-400" />
           <span className="font-bold text-sm uppercase tracking-widest text-indigo-100">Remix AI</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-[#30363D] rounded-lg">
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 w-64 bg-[#05080f] border-r border-[#30363D] flex flex-col z-20 md:z-10 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-[#30363D] hidden md:flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.4)]">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-widest uppercase text-white leading-tight">Remix AI</h1>
            <span className="text-[10px] font-medium text-indigo-400 tracking-wider">Algorithmic Engine</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto mt-16 md:mt-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner'
                  : 'text-gray-400 hover:bg-[#30363D]/50 hover:text-gray-200 border border-transparent'
              }`}
            >
              <tab.icon size={16} className={`mr-3 ${activeTab === tab.id ? 'stroke-indigo-400' : 'stroke-gray-500'}`} />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#30363D] space-y-3 bg-[#020408]">
          <div className="flex items-center justify-between text-xs font-semibold px-2">
            <span className="text-gray-500 uppercase tracking-wider">Link Status</span>
            <span className="flex items-center text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                ACTIVE
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 px-2">
            <span>Latency</span>
            <span className="text-emerald-400">0ms LOCAL</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-[#09090b] border-b border-[#30363D]">
          <div className="flex items-center gap-4">
             <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200">
               {TABS.find(t => t.id === activeTab)?.label}
             </h2>
          </div>
          <div className="flex items-center gap-4 text-sm font-mono">
            <div className="hidden sm:flex items-center gap-4 mr-4 text-gray-400">
              <span className="text-gray-600">|</span>
              <div className="flex items-center gap-1.5">
                 <span className="uppercase text-[10px] font-bold tracking-widest">Total Equity:</span>
                 <span className="text-white font-medium">$\{totalAccountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <button className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-[#30363D]/50 hover:bg-[#30363D] text-gray-400 hover:text-white transition-colors border border-gray-700">
              <Bell size={14} />
            </button>
          </div>
        </header>

        {/* Dashboard Area */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-[#09090b] via-[#05080f] to-[#020408]">
          {activeTab === 'scanner' && (
            <ScannerList 
              coins={coins} 
              onSelectCoin={(symbol) => setSelectedSymbol(symbol)} 
              selectedSymbol={selectedSymbol}
              isLoading={false}
              onManualScan={() => {}}
              autoTradeThreshold={settings.autoTradeThreshold}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsPanel 
                settings={settings} 
                onUpdateSettings={updateSettings} 
                onResetBalance={handleResetBalance}
                onResetSettings={handleResetSettings}
            />
          )}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <ActiveTrades positions={positions} onManualClose={handleManualClose} />
                {currentCoinDetail ? (
                  <TradingChart coin={currentCoinDetail} activePosition={positions.find((p) => p.symbol === currentCoinDetail.symbol)} />
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center bg-[#05080f] border border-[#30363D] rounded-xl relative p-6">
                    <RefreshCw className="w-10 h-10 stroke-indigo-400 mb-2 animate-spin" />
                    <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Synchronizing engine data...</span>
                  </div>
                )}
              </div>
              <div className="space-y-6">
                 <div className="bg-[#05080f] border border-gray-800 rounded-xl p-4 shadow-inner">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center">
                      <Terminal className="w-3.5 h-3.5 mr-1.5" /> Quant Event Log Output Console
                    </span>
                  </div>
                  <div className="h-96 overflow-y-auto font-mono text-[10px] text-gray-400 space-y-1.5 divide-y divide-gray-900/40 pr-2">
                    {terminalLogs.length === 0 ? (
                      <span className="text-gray-600">Console empty. Boot stream ready.</span>
                    ) : (
                      terminalLogs.map((logStr, index) => (
                        <div key={index} className="pt-1.5">{logStr}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'backtest' && (
            <BacktestLab settings={settings} coins={coins} selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} />
          )}
          {activeTab === 'strategy_lab' && (
            <StrategyLab settings={settings} onUpdateSettings={updateSettings} />
          )}
          {activeTab === 'risk_center' && (
            <RiskCenter
              settings={settings}
              onUpdateSettings={updateSettings}
              balance={balance}
              positions={positions}
              onManualClose={handleManualClose}
              setEngineRunning={() => { fetch('/api/engine/stop', { method: 'POST' }); }}
            />
          )}
          {activeTab === 'history' && (
             <PerformancePage
              logs={tradeLogs}
              snapshots={equitySnapshots}
              currentBalance={totalAccountValue}
              startingBalance={settings.startingBalance}
            />
          )}
          {activeTab === 'chart' && (
            <div className="h-full">
              {currentCoinDetail ? (
                <TradingChart coin={currentCoinDetail} activePosition={positions.find((p) => p.symbol === currentCoinDetail.symbol)} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-[#05080f] border border-[#30363D] rounded-xl relative p-6">
                  <RefreshCw className="w-10 h-10 stroke-indigo-400 mb-2 animate-spin" />
                  <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Synchronizing engine data...</span>
                </div>
              )}
            </div>
          )}
          {activeTab === 'positions' && (
            <div className="h-full">
               <ActiveTrades positions={positions} onManualClose={handleManualClose} />
            </div>
          )}
          {activeTab === 'logs' && (
             <div className="h-full bg-[#05080f] border border-gray-800 rounded-xl p-4 shadow-inner flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] font-bold text-indigo-400 uppercase tracking-widest flex items-center">
                  <Terminal className="w-4 h-4 mr-2" /> Quant Event Log Output Console
                </span>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] text-gray-400 space-y-2 divide-y divide-gray-900/40 pr-2">
                {terminalLogs.length === 0 ? (
                  <span className="text-gray-600">Console empty. Boot stream ready.</span>
                ) : (
                  terminalLogs.map((logStr, index) => (
                    <div key={index} className="pt-2">{logStr}</div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
