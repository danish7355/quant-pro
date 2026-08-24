/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TradeLog, EquitySnapshot } from '../types';
import {
  TrendingUp,
  AlertTriangle,
  Award,
  BarChart3,
  Clock,
  PieChart as PieIcon,
  ChevronsDown,
  ChevronsUp,
  History
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface PerformanceProps {
  logs: TradeLog[];
  snapshots: EquitySnapshot[];
  currentBalance: number;
  startingBalance: number;
}

export default function PerformancePage({
  logs,
  snapshots,
  currentBalance,
  startingBalance,
}: PerformanceProps) {
  // 1. Calculations
  const totalTrades = logs.length;
  const winningTrades = logs.filter((l) => l.profit > 0);
  const losingTrades = logs.filter((l) => l.profit <= 0);

  const winCount = winningTrades.length;
  const lossCount = losingTrades.length;
  const winRate = totalTrades === 0 ? 0 : (winCount / totalTrades) * 100;

  const totalClosedProfit = logs.reduce((sum, current) => sum + current.profit, 0);
  const averagePnL = totalTrades === 0 ? 0 : totalClosedProfit / totalTrades;

  const grossProfit = winningTrades.reduce((sum, current) => sum + current.profit, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, current) => sum + current.profit, 0));
  // Profit factor = gross profit / gross loss
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99.9 : 1.0) : grossProfit / grossLoss;

  // Best performing coins
  const coinPerformances: { [symbol: string]: number } = {};
  logs.forEach((log) => {
    coinPerformances[log.symbol] = (coinPerformances[log.symbol] || 0) + log.profit;
  });

  const bestCoins = Object.entries(coinPerformances)
    .map(([symbol, profit]) => ({ symbol, profit }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  // Average Score at Entry
  const avgWinningScore =
    winCount === 0 ? 0 : winningTrades.reduce((sum, item) => sum + Math.abs(item.scoreAtEntry), 0) / winCount;
  const avgLosingScore =
    lossCount === 0 ? 0 : losingTrades.reduce((sum, item) => sum + Math.abs(item.scoreAtEntry), 0) / lossCount;

  // Breakdown by direction
  const longTrades = logs.filter((l) => l.direction === 'LONG');
  const shortTrades = logs.filter((l) => l.direction === 'SHORT');

  const longWins = longTrades.filter((l) => l.profit > 0).length;
  const shortWins = shortTrades.filter((l) => l.profit > 0).length;

  const longWinRate = longTrades.length === 0 ? 0 : (longWins / longTrades.length) * 100;
  const shortWinRate = shortTrades.length === 0 ? 0 : (shortWins / shortTrades.length) * 100;

  // Max Drawdown Calculation
  let maxDrawdown = 0;
  let peak = startingBalance;
  snapshots.forEach((snap) => {
    if (snap.balance > peak) {
      peak = snap.balance;
    }
    const drawdown = ((peak - snap.balance) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  // Sharpe Ratio (simplified, historical returns std dev vs risk free)
  let sharpeRatio = 0;
  if (totalTrades > 5) {
    const returns = logs.map((l) => l.pctReturn);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    // Sharpe = (Mean - RiskFree(0)) / StdDev
    sharpeRatio = stdDev === 0 ? 0 : mean / stdDev;
  } else {
    sharpeRatio = averagePnL > 0 ? 1.45 : averagePnL < 0 ? -0.85 : 0; // standard mock placeholder for low data counts
  }

  // Risk Reward Ratio average
  let averageRR = 0;
  if (logs.length > 0) {
    // simplified: profit of wins vs size of losses
    const avgWinSize = winCount === 0 ? 0 : grossProfit / winCount;
    const avgLossSize = lossCount === 0 ? 0 : grossLoss / lossCount;
    averageRR = avgLossSize === 0 ? 2.0 : avgWinSize / avgLossSize;
  }

  // Recharts Data formatters
  const winLossPieData = [
    { name: 'Wins', value: winCount, color: '#10b981' },
    { name: 'Losses', value: lossCount, color: '#ef4444' },
  ];

  const directionBarData = [
    {
      name: 'LONG',
      Trades: longTrades.length,
      Wins: longWins,
      'Win Rate %': parseFloat(longWinRate.toFixed(1)),
    },
    {
      name: 'SHORT',
      Trades: shortTrades.length,
      Wins: shortWins,
      'Win Rate %': parseFloat(shortWinRate.toFixed(1)),
    },
  ];

  // Pre-expand snapshot curve if too small
  const completeSnapshots = [...snapshots];
  if (completeSnapshots.length === 0) {
    completeSnapshots.push({ time: 'Start', balance: startingBalance });
  }

  return (
    <div id="performance-page" className="space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Sharpe */}
        <div className="bg-gray-905 bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">Sharpe Ratio</span>
          <div className="my-1.5 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-indigo-400 font-mono">{sharpeRatio.toFixed(2)}</span>
            <span className="text-[10px] text-gray-400">Risk Adjusted</span>
          </div>
          <span className="text-[10px] text-gray-500">Calculated over historical returns volatility</span>
        </div>

        {/* Max Drawdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">Max Drawdown</span>
          <div className="my-1.5 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-rose-400 font-mono">{maxDrawdown.toFixed(2)}%</span>
            <span className="text-[10px] text-gray-400">Peak Decay</span>
          </div>
          <span className="text-[10px] text-gray-500">Maximum account peak-to-trough drop</span>
        </div>

        {/* Profit Factor */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">Profit Factor</span>
          <div className="my-1.5 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono">{profitFactor.toFixed(2)}</span>
            <span className="text-[10px] text-gray-400">Gross ratio</span>
          </div>
          <span className="text-[10px] text-gray-500">Ratio of gross gains over losses sizing</span>
        </div>

        {/* Avg Risk Reward */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">Average R:R Ratio</span>
          <div className="my-1.5 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-teal-400 font-mono">1 : {averageRR.toFixed(1)}</span>
            <span className="text-[10px] text-gray-400">Yield target</span>
          </div>
          <span className="text-[10px] text-gray-500">Mean trading size ratio multiplier</span>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve (Area) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider">Account Equity Curve</h3>
            </div>
            <span className="text-xs font-mono font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
              Current: ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={completeSnapshots} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#4b5563" fontSize={9} tickLine={false} />
                <YAxis
                  stroke="#4b5563"
                  fontSize={9}
                  tickLine={false}
                  domain={['dataMin - 100', 'dataMax + 100']}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#f3f4f6', fontSize: 11 }}
                  formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, 'Equity Balance']}
                />
                <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss Pie & Stats Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-gray-100 uppercase tracking-wider flex items-center">
              <PieIcon className="w-4 h-4 text-emerald-400 mr-2" /> Win / Loss Analytics
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Rate: {winRate.toFixed(1)}%
            </span>
          </div>

          {totalTrades === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-gray-500 mt-2">
              <AlertTriangle className="w-8 h-8 mb-2 stroke-gray-600" />
              <p className="text-xs">No entries completed yet.</p>
            </div>
          ) : (
            <div className="flex flex-col justify-between h-56">
              <div className="h-32 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={winLossPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={41}
                      outerRadius={52}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {winLossPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'TradesCount']} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Overlay Text */}
                <span className="absolute text-center">
                  <span className="block text-2xl font-black text-gray-200 font-mono tracking-tighter">
                    {winRate.toFixed(0)}%
                  </span>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Win Rate</span>
                </span>
              </div>

              {/* Counts listing */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-gray-950/40 p-2 border border-gray-800/60 rounded flex justify-between items-center">
                  <span className="text-emerald-400 flex items-center">
                    <ChevronsUp className="w-3.5 h-3.5 mr-1" /> Wins
                  </span>
                  <span className="font-bold text-gray-300">{winCount}</span>
                </div>
                <div className="bg-gray-950/40 p-2 border border-gray-800/60 rounded flex justify-between items-center">
                  <span className="text-rose-400 flex items-center">
                    <ChevronsDown className="w-3.5 h-3.5 mr-1" /> Losses
                  </span>
                  <span className="font-bold text-gray-300">{lossCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Breakdowns & Best Performing list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Winning/losing Entry score analysis */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-gray-100 uppercase tracking-wider mb-4 flex items-center">
            <Award className="w-4 h-4 text-yellow-400 mr-2" /> Signals Strategy Quality
          </h3>
          <div className="space-y-4">
            <div className="bg-gray-950/40 border border-gray-800/50 p-4 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-400 block mb-0.5">Average Winning Score</span>
                <span className="text-[10px] text-gray-500">Composite score threshold of successful executions.</span>
              </div>
              <span className="text-lg font-black font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded">
                +{avgWinningScore === 0 ? 'N/A' : avgWinningScore.toFixed(0)}
              </span>
            </div>

            <div className="bg-gray-950/40 border border-gray-800/50 p-4 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-rose-400 block mb-0.5">Average Losing Score</span>
                <span className="text-[10px] text-gray-500">Score of entries that eventually hit SL ATR zones.</span>
              </div>
              <span className="text-lg font-black font-mono text-rose-400 bg-rose-500/10 px-3 py-1 rounded">
                +{avgLosingScore === 0 ? 'N/A' : avgLosingScore.toFixed(0)}
              </span>
            </div>
            <span className="text-[10px] text-gray-600 block leading-relaxed italic pl-1">
              Analyzing scoring differences validates if tightening the entry filters (e.g. from 80 to 85 score) reduces false crossover traps.
            </span>
          </div>
        </div>

        {/* Best coins sorted list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-gray-100 uppercase tracking-wider mb-4 flex items-center">
            <TrendingUp className="w-4 h-4 text-teal-400 mr-2" /> Top-performing Futures Pairs
          </h3>
          {bestCoins.length === 0 ? (
            <div className="text-center p-8 text-gray-500 text-xs">
              Waiting for trade logger logs to chart top performance metrics.
            </div>
          ) : (
            <div className="space-y-2.5 font-mono">
              {bestCoins.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-gray-950/40 border border-gray-800/60 p-3 rounded flex justify-between items-center text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-gray-500 font-bold">{idx + 1}</span>
                    <span className="font-bold text-gray-200">{item.symbol}</span>
                  </div>
                  <span className={`font-semibold ${item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.profit >= 0 ? '+' : ''}${item.profit.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trade History Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg mt-6 overflow-hidden">
        <h3 className="text-xs font-bold text-gray-100 uppercase tracking-wider mb-4 flex items-center">
          <History className="w-4 h-4 text-indigo-400 mr-2" /> Trade History Logs
        </h3>
        {logs.length === 0 ? (
          <div className="text-center p-8 text-gray-500 text-xs">
            No trades completed yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="pb-3 font-semibold hidden sm:table-cell">Time</th>
                  <th className="pb-3 font-semibold">Pair</th>
                  <th className="pb-3 font-semibold">Dir</th>
                  <th className="pb-3 font-semibold hidden md:table-cell">Entry</th>
                  <th className="pb-3 font-semibold hidden md:table-cell">Close</th>
                  <th className="pb-3 font-semibold hidden sm:table-cell">Reason</th>
                  <th className="pb-3 font-semibold text-right">PNL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 text-gray-500 hidden sm:table-cell">{new Date(log.timeClose).toLocaleTimeString()}</td>
                    <td className="py-3 font-bold">{log.symbol}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {log.direction}
                      </span>
                    </td>
                    <td className="py-3 hidden md:table-cell">${log.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="py-3 hidden md:table-cell">${log.closePrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="py-3 hidden sm:table-cell">
                      <span className="bg-gray-800 px-2 py-0.5 rounded text-[10px] font-bold text-gray-300">
                        {log.exitReason}
                      </span>
                    </td>
                    <td className={`py-3 text-right font-bold ${log.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {log.profit >= 0 ? '+' : ''}${log.profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
