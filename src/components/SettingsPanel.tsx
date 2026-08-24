import React, { useState } from 'react';
import { AppSettings, Timeframe } from '../types';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetBalance: (amount: number) => void;
  onResetSettings: () => void;
}

const LocalNumberInput = ({ value, onChange, className }: any) => {
  const [localValue, setLocalValue] = React.useState(value?.toString() ?? "");

  React.useEffect(() => {
    setLocalValue(value?.toString() ?? "");
  }, [value]);

  const handleBlur = () => {
    let finalValue = parseFloat(localValue);
    if (isNaN(finalValue)) finalValue = 0;
    setLocalValue(finalValue.toString());
    onChange(finalValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
};

const InputRow = ({ label, desc, value, onChange, type = "number", className="" }: any) => {
  const [localValue, setLocalValue] = React.useState(value?.toString() ?? "");

  React.useEffect(() => {
    setLocalValue(value?.toString() ?? "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    if (type !== 'number') {
      onChange(e.target.value);
    }
  };

  const handleBlur = () => {
    if (type === 'number') {
      let finalValue = parseFloat(localValue);
      if (isNaN(finalValue)) finalValue = 0;
      setLocalValue(finalValue.toString());
      onChange(finalValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
      e.currentTarget.blur();
    }
  };

  return (
    <div className={`flex justify-between items-center py-4 border-b border-gray-800/50 last:border-0 ${className}`}>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-gray-200">{label}</span>
        <span className="text-[11px] text-gray-500 max-w-sm leading-relaxed">{desc}</span>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type={type}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-24 bg-gray-900 border border-gray-800 rounded p-1.5 text-right font-mono text-sm font-semibold text-gray-300 focus:outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  );
};

export default function SettingsPanel({ settings, onUpdateSettings, onResetBalance, onResetSettings }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'ema' | 'indicators' | 'filters' | 'risk' | 'autotrade' | 'alerts'>('general');
  const [showBotToken, setShowBotToken] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSaveSettings = () => {
    // Force blur on the active element to trigger any pending local updates
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSaveStatus('Settings Saved!');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleInputChange = (category: keyof AppSettings | string, value: string | number | boolean) => {
    const updated = { ...settings, [category]: value } as AppSettings;
    onUpdateSettings(updated);
  };

  const testTelegramConnection = async () => {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      setTelegramStatus('Please define Bot Token and Chat ID first.');
      return;
    }
    setTelegramStatus('Sending test alert...');
    try {
      const text = encodeURIComponent(`🤖 *CryptoBot Pro*\n\n📡 Connection Verified Successfully!`);
      const response = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage?chat_id=${settings.telegramChatId}&text=${text}&parse_mode=Markdown`);
      if (response.ok) {
        setTelegramStatus('Test alert sent! Check your Telegram.');
      } else {
        const errJson = await response.json().catch(() => ({}));
        setTelegramStatus(`Failed: ${errJson.description || 'Check token/permissions'}`);
      }
    } catch (e: any) {
      setTelegramStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-hidden shadow-lg h-full flex flex-col">
      <div className="bg-[#1e293b] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-widest uppercase">STRATEGY SETTINGS</h2>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={onResetSettings}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset Defaults</span>
          </button>
          <button 
            onClick={handleSaveSettings}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#00e696] text-[#0f172a] hover:bg-[#00c984] text-sm font-bold transition-colors"
          >
            <span>{saveStatus || 'Save Settings'}</span>
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-800 px-4 pt-2 space-x-6 overflow-x-auto bg-[#1e293b]">
        {[
          { id: 'general', label: 'General System' },
          { id: 'ema', label: 'EMA Strategy' },
          { id: 'indicators', label: 'Indicators' },
          { id: 'filters', label: 'Filters' },
          { id: 'risk', label: 'Risk Management' },
          { id: 'autotrade', label: 'Auto-Trade' },
          { id: 'alerts', label: 'Alerts' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'text-[#00e696] border-b-2 border-[#00e696]' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {activeTab === 'general' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center py-4 border-b border-gray-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-200">Market</span>
                <span className="text-[11px] text-gray-500">Switch between Crypto Futures and Indian Stock Market (NSE).</span>
              </div>
              <div className="flex bg-[#0f172a] rounded p-1 border border-gray-800">
                {['CRYPTO', 'NSE'].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleInputChange('market', m)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${settings.market === m || (!settings.market && m === 'CRYPTO') ? 'bg-[#00e696] text-[#0f172a]' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <InputRow label="Scan Interval (Secs)" desc="How often the scanner runs" value={settings.scanInterval} onChange={(v: any) => handleInputChange('scanInterval', v)} />
            <InputRow label="Coins to Scan" desc="Number of top coins by volume to scan" value={settings.coinCount} onChange={(v: any) => handleInputChange('coinCount', v)} />
            
            <div className="flex justify-between items-center py-4 border-b border-gray-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-200">Timeframe</span>
                <span className="text-[11px] text-gray-500">Base timeframe for all algorithmic indicators.</span>
              </div>
              <div className="flex bg-[#0f172a] rounded p-1 border border-gray-800">
                {['5m', '15m', '1H', '4H', '1D'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleInputChange('timeframe', tf)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${settings.timeframe === tf ? 'bg-[#00e696] text-[#0f172a]' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center py-4 border-b border-gray-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-200">Auto Trade Execution Engine</span>
                <span className="text-[11px] text-gray-500">Allow bot to automatically open paper positions on strict trigger.</span>
              </div>
              <button
                onClick={() => handleInputChange('autoTradeEnabled', !settings.autoTradeEnabled)}
                className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings.autoTradeEnabled ? 'bg-[#00e696]' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.autoTradeEnabled ? 'transform translate-x-6' : ''}`} />
              </button>
            </div>
            
            <div className="flex justify-between items-center py-4 border-b border-gray-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-200">Starting Paper Balance</span>
                <span className="text-[11px] text-gray-500">Wipe current performance data and reset equity.</span>
              </div>
              <div className="flex items-center space-x-2">
                <LocalNumberInput
                  value={settings.startingBalance}
                  onChange={(v: any) => handleInputChange('startingBalance', v)}
                  className="w-24 bg-gray-900 border border-gray-800 rounded p-1.5 text-right font-mono text-sm font-semibold text-gray-300 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => onResetBalance(settings.startingBalance)}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded border border-rose-500/30 transition-colors"
                >
                  RESET
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ema' && (
          <div className="space-y-2">
            <InputRow label="EMA Fast Period" desc="Fast EMA for crossover detection (default: 20)" value={settings.emaFastPeriod} onChange={(v: any) => handleInputChange('emaFastPeriod', v)} />
            <InputRow label="EMA Slow Period" desc="Slow EMA for crossover detection (default: 55)" value={settings.emaSlowPeriod} onChange={(v: any) => handleInputChange('emaSlowPeriod', v)} />
            <InputRow label="EMA Trend Period" desc="Long-term trend EMA (default: 200)" value={settings.emaTrendPeriod} onChange={(v: any) => handleInputChange('emaTrendPeriod', v)} />
            <InputRow label="EMA Cross Lookback" desc="Candles to look back for EMA crossover" value={settings.emaCrossLookback} onChange={(v: any) => handleInputChange('emaCrossLookback', v)} />
            <InputRow label="Minimum Score for Trade" desc="Signal score threshold to open a trade (0-100)" value={settings.autoTradeThreshold} onChange={(v: any) => handleInputChange('autoTradeThreshold', v)} />
            <InputRow label="Minimum R:R Ratio" desc="Minimum risk-reward ratio required" value={settings.minRRRatio} onChange={(v: any) => handleInputChange('minRRRatio', v)} />
          </div>
        )}

        {activeTab === 'indicators' && (
          <div className="space-y-2">
            <InputRow label="RSI Period" desc="RSI calculation period (default: 14)" value={settings.rsiPeriod} onChange={(v: any) => handleInputChange('rsiPeriod', v)} />
            
            <div className="flex flex-col py-4 border-b border-gray-800/50">
              <div className="flex justify-between items-center w-full mb-1">
                <span className="text-sm font-bold text-gray-200">RSI LONG Range</span>
                <div className="flex items-center space-x-2">
                  <LocalNumberInput value={settings.rsiLongMin} onChange={(v: any) => handleInputChange('rsiLongMin', v)} className="w-16 bg-gray-900 border border-gray-800 rounded p-1.5 text-center font-mono text-sm text-gray-300" />
                  <span className="text-gray-500">-</span>
                  <LocalNumberInput value={settings.rsiLongMax} onChange={(v: any) => handleInputChange('rsiLongMax', v)} className="w-16 bg-gray-900 border border-gray-800 rounded p-1.5 text-center font-mono text-sm text-gray-300" />
                </div>
              </div>
              <span className="text-[11px] text-gray-500">RSI range considered optimal for LONG signals</span>
            </div>

            <div className="flex flex-col py-4 border-b border-gray-800/50">
              <div className="flex justify-between items-center w-full mb-1">
                <span className="text-sm font-bold text-gray-200">RSI SHORT Range</span>
                <div className="flex items-center space-x-2">
                  <LocalNumberInput value={settings.rsiShortMin} onChange={(v: any) => handleInputChange('rsiShortMin', v)} className="w-16 bg-gray-900 border border-gray-800 rounded p-1.5 text-center font-mono text-sm text-gray-300" />
                  <span className="text-gray-500">-</span>
                  <LocalNumberInput value={settings.rsiShortMax} onChange={(v: any) => handleInputChange('rsiShortMax', v)} className="w-16 bg-gray-900 border border-gray-800 rounded p-1.5 text-center font-mono text-sm text-gray-300" />
                </div>
              </div>
              <span className="text-[11px] text-gray-500">RSI range considered optimal for SHORT signals</span>
            </div>

            <InputRow label="ADX Period" desc="ADX trend strength period" value={settings.adxPeriod} onChange={(v: any) => handleInputChange('adxPeriod', v)} />
            <InputRow label="ADX Minimum Threshold" desc="Minimum ADX for trend confirmation" value={settings.adxTrendThreshold} onChange={(v: any) => handleInputChange('adxTrendThreshold', v)} />
            <InputRow label="ATR Period" desc="ATR period for stop/target calculation" value={settings.atrPeriod} onChange={(v: any) => handleInputChange('atrPeriod', v)} />
            <InputRow label="ATR Stop Loss Multiplier" desc="Stop loss = Entry ± ATR × multiplier" value={settings.slAtrMultiple} onChange={(v: any) => handleInputChange('slAtrMultiple', v)} />
            <InputRow label="ATR Take Profit Multiplier" desc="Take profit = Entry ± ATR × multiplier" value={settings.tp1AtrMultiple} onChange={(v: any) => handleInputChange('tp1AtrMultiple', v)} />
            <InputRow label="Volume Spike Multiplier" desc="Volume must be X× the 20-period average" value={settings.volumeMultiplier} onChange={(v: any) => handleInputChange('volumeMultiplier', v)} />
            
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-6 mb-2">MACD</h3>
            <InputRow label="MACD Fast" desc="MACD Fast Period" value={settings.macdFast} onChange={(v: any) => handleInputChange('macdFast', v)} />
            <InputRow label="MACD Slow" desc="MACD Slow Period" value={settings.macdSlow} onChange={(v: any) => handleInputChange('macdSlow', v)} />
            <InputRow label="MACD Signal" desc="MACD Signal Period" value={settings.macdSignal} onChange={(v: any) => handleInputChange('macdSignal', v)} />
            
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-6 mb-2">FIBONACCI</h3>
            <InputRow label="Fibonacci Lookback" desc="Lookback for swing high/low" value={settings.fibLookback} onChange={(v: any) => handleInputChange('fibLookback', v)} />
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="space-y-2">
            <InputRow label="Minimum 24h Volume (USDT)" desc="Skip coins with volume below this threshold" value={settings.min24hVolume} onChange={(v: any) => handleInputChange('min24hVolume', v)} />
            <InputRow label="Max Funding Rate %" desc="Skip coins with extreme funding rates" value={settings.maxFundingRate} onChange={(v: any) => handleInputChange('maxFundingRate', v)} />
            <InputRow label="Max Bid/Ask Spread %" desc="Skip coins with wide spreads" value={settings.maxSpread} onChange={(v: any) => handleInputChange('maxSpread', v)} />
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="space-y-2">
            <InputRow label="Position Margin per Trade %" desc="% of total balance per trade (old setting)" value={settings.positionSizePct} onChange={(v: any) => handleInputChange('positionSizePct', v)} />
            <InputRow label="Account Risk Per Trade %" desc="% of account to risk per trade (new setting)" value={settings.accountRiskPct} onChange={(v: any) => handleInputChange('accountRiskPct', v)} />
            <InputRow label="Max Open Trades" desc="Maximum simultaneous positions" value={settings.maxConcurrentTrades} onChange={(v: any) => handleInputChange('maxConcurrentTrades', v)} />
            <InputRow label="Leverage" desc="Default leverage for new positions" value={settings.leverage} onChange={(v: any) => handleInputChange('leverage', v)} />
            <InputRow label="Max Daily Loss %" desc="Stop trading for the day above this loss" value={settings.dailyLossLimitPct} onChange={(v: any) => handleInputChange('dailyLossLimitPct', v)} />
          </div>
        )}

        {activeTab === 'autotrade' && (
          <div className="space-y-2">
            <InputRow label="Max Drawdown %" desc="Pause trading above this total drawdown" value={settings.maxDrawdownPct} onChange={(v: any) => handleInputChange('maxDrawdownPct', v)} />
            
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-6 mb-2">ADDITIONAL TARGETS</h3>
            <InputRow label="Take Profit 2 ATR Multiple" desc="Take Profit 2 (optional)" value={settings.tp2AtrMultiple} onChange={(v: any) => handleInputChange('tp2AtrMultiple', v)} />
            <InputRow label="Take Profit 3 Fib Level" desc="Take Profit 3 (optional)" value={settings.tp3FibLevel} onChange={(v: any) => handleInputChange('tp3FibLevel', v)} />
            
            <div className="flex justify-between items-center py-4 border-b border-gray-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-200">Time-Based Exit Enabled</span>
                <span className="text-[11px] text-gray-500">Enable time-based exit mechanism</span>
              </div>
              <button
                onClick={() => handleInputChange('timeBasedExitEnabled', !settings.timeBasedExitEnabled)}
                className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings.timeBasedExitEnabled ? 'bg-[#00e696]' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.timeBasedExitEnabled ? 'transform translate-x-6' : ''}`} />
              </button>
            </div>
            {settings.timeBasedExitEnabled && (
               <InputRow label="Time-Based Exit Candles" desc="Close positions after N candles if not profitable" value={settings.timeBasedExitCandles} onChange={(v: any) => handleInputChange('timeBasedExitCandles', v)} />
            )}

            <div className="flex justify-between items-center py-4 border-b border-gray-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-200">Use Trailing Stop</span>
                <span className="text-[11px] text-gray-500">Enable trailing stop loss for open trades</span>
              </div>
              <button
                onClick={() => handleInputChange('trailingStopActivation', settings.trailingStopActivation === 'NEVER' ? 'TP1' : 'NEVER')}
                className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings.trailingStopActivation !== 'NEVER' ? 'bg-[#00e696]' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.trailingStopActivation !== 'NEVER' ? 'transform translate-x-6' : ''}`} />
              </button>
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-6 mb-2">SUPERTREND TRAILING STOP</h3>
            <InputRow label="SuperTrend ATR Period" desc="ATR window used for SuperTrend bands (default: 12)" value={settings.superTrendPeriod} onChange={(v: any) => handleInputChange('superTrendPeriod', v)} />
            <InputRow label="SuperTrend Multiplier" desc="Band width = ATR × multiplier (default: 3.0)" value={settings.superTrendMultiplier} onChange={(v: any) => handleInputChange('superTrendMultiplier', v)} />
            <InputRow label="Trail Activation R" desc="Activate trailing exit after this many R earned (default: 1.0)" value={settings.trailActivationR} onChange={(v: any) => handleInputChange('trailActivationR', v)} />
          </div>
        )}

        {activeTab === 'alerts' && (
           <div className="space-y-4 max-w-lg">
             <div className="bg-gray-900 border border-gray-800 rounded p-4">
               <h3 className="text-sm font-bold text-gray-200 mb-4">Telegram Bot Integration</h3>
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-400 block mb-1">Bot Token</label>
                   <div className="relative">
                     <input type={showBotToken ? 'text' : 'password'} value={settings.telegramBotToken} onChange={(e) => handleInputChange('telegramBotToken', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm text-gray-300 pr-10" />
                     <button onClick={() => setShowBotToken(!showBotToken)} className="absolute right-2 top-2 text-gray-500 hover:text-gray-300">
                       {showBotToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                     </button>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-400 block mb-1">Chat ID</label>
                   <input type="text" value={settings.telegramChatId} onChange={(e) => handleInputChange('telegramChatId', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm text-gray-300" />
                 </div>
                 <button onClick={testTelegramConnection} className="w-full py-2 bg-[#00e696] hover:bg-[#00c984] text-[#0f172a] font-bold rounded text-xs transition duration-200">
                   TEST NOTIFICATION PING
                 </button>
                 {telegramStatus && <p className="text-xs text-indigo-300 mt-2 font-mono bg-indigo-900/20 py-2 px-3 rounded border border-indigo-500/20">{telegramStatus}</p>}
               </div>
             </div>
             
             <div className="space-y-2 mt-4">
               <h3 className="text-sm font-bold text-gray-200 mb-2">Event Triggers</h3>
               {[
                 { id: 'alertOnNewSignal', label: 'New High-Score Signal Detected' },
                 { id: 'alertOnTradeExecuted', label: 'Trade Automatically Executed' },
                 { id: 'alertOnTpHit', label: 'Take Profit Hit' },
                 { id: 'alertOnSlHit', label: 'Stop Loss Hit' },
                 { id: 'alertOnTsMoved', label: 'Trailing Stop Moved' },
                 { id: 'alertOnDailyLossLimit', label: 'Daily Loss Limit Reached' },
                 { id: 'alertOnRangingDetected', label: 'Ranging Market Detected' },
               ].map((setting) => (
                 <div key={setting.id} className="flex justify-between items-center py-2 px-3 bg-gray-800/20 rounded border border-gray-800">
                   <span className="text-sm text-gray-300">{setting.label}</span>
                   <button
                     onClick={() => handleInputChange(setting.id, !(settings as any)[setting.id])}
                     className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${
                       (settings as any)[setting.id] ? 'bg-[#00e696]' : 'bg-gray-700'
                     }`}
                   >
                     <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                       (settings as any)[setting.id] ? 'transform translate-x-5' : ''
                     }`} />
                   </button>
                 </div>
               ))}
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
