/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, LineChart, BarChart2, ShieldCheck, Award, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { AppSettings } from '../types';
import { runBacktest, BacktestResult } from '../utils/backtestEngine';

interface BacktestLabProps {
  settings: AppSettings;
  coins: any[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export default function BacktestLab({ settings, coins, selectedSymbol, onSelectSymbol }: BacktestLabProps) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleExecuteBacktest = () => {
    setRunning(true);
    const targetCoin = coins.find(c => c.symbol === selectedSymbol) || coins[0];
    if (!targetCoin || !targetCoin.candles) {
      setRunning(false);
      return;
    }

    // Run backtest calculation
    setTimeout(() => {
      const res = runBacktest(targetCoin.candles, settings, targetCoin.symbol);
      setResult(res);
      setRunning(false);
    }, 100);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-gray-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-[#161B22] p-4 rounded-xl border border-[#30363D]">
        <div>
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <LineChart size={16} /> BACKTEST ENGINE & STRATEGY LAB
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Chronological multi-candle replay with 0 look-ahead bias, simulated 0.04% taker fee, and 0.03% slippage.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={selectedSymbol}
            onChange={(e) => onSelectSymbol(e.target.value)}
            className="bg-[#0E1117] border border-[#30363D] text-xs rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {coins.map((c) => (
              <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
            ))}
          </select>

          <button
            onClick={handleExecuteBacktest}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            {running ? 'REPLAYING CANDLES...' : 'RUN BACKTEST'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-[#161B22] border border-[#30363D] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 block uppercase">Net Return</span>
              <span className={`text-sm font-bold ${result.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${result.netProfit.toFixed(2)} ({result.returnPct.toFixed(1)}%)
              </span>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 block uppercase">Win Rate</span>
              <span className="text-sm font-bold text-blue-400">
                {result.winRatePct.toFixed(1)}% ({result.winningTrades}/{result.totalTrades})
              </span>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 block uppercase">Profit Factor</span>
              <span className="text-sm font-bold text-indigo-400">
                {result.profitFactor.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 block uppercase">Expectancy</span>
              <span className="text-sm font-bold text-purple-400">
                ${result.expectancyUsd.toFixed(2)} / trade
              </span>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 block uppercase">Max Drawdown</span>
              <span className="text-sm font-bold text-rose-400">
                -{result.maxDrawdownPct.toFixed(1)}%
              </span>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 block uppercase">Final Balance</span>
              <span className="text-sm font-bold text-emerald-400">
                ${result.finalBalance.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] p-3 rounded-lg">
              <span className="text-[10px] text-gray-500 block uppercase">Trades Count</span>
              <span className="text-sm font-bold text-gray-300">
                {result.totalTrades}
              </span>
            </div>
          </div>

          {/* Trade Log Table */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Backtest Trade Execution Replay Logs
            </h4>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0E1117] text-gray-500 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2 hidden md:table-cell">ID</th>
                    <th className="p-2">Direction</th>
                    <th className="p-2 hidden sm:table-cell">Entry Price</th>
                    <th className="p-2 hidden sm:table-cell">Exit Price</th>
                    <th className="p-2 hidden md:table-cell">Exit Reason</th>
                    <th className="p-2">Profit (USD)</th>
                    <th className="p-2">Return (%)</th>
                    <th className="p-2 hidden sm:table-cell">Time Close</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]">
                  {result.tradeLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-gray-500">
                        No trades triggered during backtest lookback window.
                      </td>
                    </tr>
                  ) : (
                    result.tradeLogs.map((t) => (
                      <tr key={t.id} className="hover:bg-[#21262D]">
                        <td className="p-2 font-mono text-gray-500 hidden md:table-cell">{t.id}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="p-2 hidden sm:table-cell">${t.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                        <td className="p-2 hidden sm:table-cell">${t.closePrice.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                        <td className="p-2 hidden md:table-cell">
                          <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                            {t.exitReason}
                          </span>
                        </td>
                        <td className={`p-2 font-bold ${t.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${t.profit.toFixed(2)}
                        </td>
                        <td className={`p-2 ${t.pctReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pctReturn.toFixed(1)}%
                        </td>
                        <td className="p-2 text-gray-500 text-[10px] hidden sm:table-cell">{t.timeClose.split('T')[1]?.slice(0, 8)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
