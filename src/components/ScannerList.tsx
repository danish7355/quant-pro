/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CoinDetail, SignalDirection, CoinStatus } from '../types';
import { Search, ArrowUpDown, ShieldAlert, Zap, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import { PriceFlasher } from './PriceFlasher';

interface ScannerListProps {
  coins: CoinDetail[];
  selectedSymbol: string;
  onSelectCoin: (symbol: string) => void;
  isLoading: boolean;
  onManualScan: () => void;
  autoTradeThreshold: number;
}

type SortField = 'symbol' | 'price' | 'change24h' | 'score' | 'status' | 'adx' | 'rsi';

export default function ScannerList({
  coins,
  selectedSymbol,
  onSelectCoin,
  isLoading,
  onManualScan,
  autoTradeThreshold,
}: ScannerListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | CoinStatus>('ALL');
  const [signalFilter, setSignalFilter] = useState<'ALL' | SignalDirection>('ALL');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // 1. Process coins (Filter & Sort)
  const filteredCoins = coins
    .filter((coin) => {
      const matchSearch = coin.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || coin.status === statusFilter;
      const matchSignal = signalFilter === 'ALL' || coin.direction === signalFilter;
      return matchSearch && matchStatus && matchSignal;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'change24h':
          comparison = a.change24h - b.change24h;
          break;
        case 'score':
          comparison = Math.abs(a.score) - Math.abs(b.score);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'adx':
          comparison = a.indicators.adx.adx - b.indicators.adx.adx;
          break;
        case 'rsi':
          comparison = a.indicators.rsi - b.indicators.rsi;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });

  const getScoreColor = (score: number) => {
    const absScore = Math.abs(score);
    if (absScore < 40) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (absScore < 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  const getSignalBadge = (dir: SignalDirection) => {
    if (dir === 'LONG') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold">
          <TrendingUp className="w-3 h-3" />
          <span>LONG</span>
        </span>
      );
    }
    if (dir === 'SHORT') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-extrabold">
          <TrendingDown className="w-3 h-3" />
          <span>SHORT</span>
        </span>
      );
    }
    return (
      <span className="inline-flex px-2 py-0.5 rounded bg-gray-800 text-gray-500 text-[10px] font-semibold border border-transparent">
        NEUTRAL
      </span>
    );
  };

  const getStatusBadge = (status: CoinStatus) => {
    if (status === 'STRONG_TREND' || status === 'TRENDING') {
      return (
        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] uppercase font-bold tracking-wider border border-cyan-500/20">
          STRONG TREND
        </span>
      );
    }
    if (status === 'WEAK_TREND') {
      return (
        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold tracking-wider border border-blue-500/20">
          WEAK TREND
        </span>
      );
    }
    if (status === 'RANGE' || status === 'RANGING') {
      return (
        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] uppercase font-bold tracking-wider border border-amber-500/20">
          RANGE
        </span>
      );
    }
    if (status === 'TRANSITION') {
      return (
        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] uppercase font-bold tracking-wider border border-purple-500/20">
          TRANSITION
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
      {/* Search and Filters Strip */}
      <div className="p-4 bg-gray-950/40 border-b border-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 font-semibold">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          {/* Seek Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-900 border border-gray-800 focus:border-gray-700 focus:outline-none rounded-lg text-xs placeholder-gray-500 font-mono text-gray-200 pl-9 pr-4 py-2 w-full md:w-48"
            />
          </div>

          {/* Badges Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mr-1 leading-none">
              Filters:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-gray-900 text-gray-300 border border-gray-800 rounded p-1 text-[11px]"
            >
              <option value="ALL">All States</option>
              <option value="STRONG_TREND">Strong Trend</option>
              <option value="WEAK_TREND">Weak Trend</option>
              <option value="TRANSITION">Transition</option>
              <option value="RANGE">Range</option>
              <option value="UNSAFE">Unsafe</option>
            </select>

            <select
              value={signalFilter}
              onChange={(e) => setSignalFilter(e.target.value as any)}
              className="bg-gray-900 text-gray-300 border border-gray-800 rounded p-1 text-[11px]"
            >
              <option value="ALL">All Signals</option>
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
              <option value="NEUTRAL">Neutral</option>
            </select>
          </div>
        </div>

        {/* Scan & Counts controls */}
        <div className="flex items-center space-x-2 justify-between">
          <span className="text-[10px] text-gray-500 font-mono">
            Filtered: {filteredCoins.length} / {coins.length} coins
          </span>

          <button
            onClick={onManualScan}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-gray-850 hover:bg-gray-800 text-indigo-400 hover:text-white border border-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Scanning...' : 'Scan Now'}</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-gray-800/80 text-gray-400/90 font-sans uppercase text-[10px] tracking-wider select-none bg-gray-950/20">
              <th className="py-3 px-4 mr-0 p-1 font-bold cursor-pointer hover:text-white" onClick={() => handleSort('symbol')}>
                <div className="flex items-center">
                  <span>Symbol</span>
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="py-3 px-4 font-bold cursor-pointer hover:text-white text-right" onClick={() => handleSort('price')}>
                <div className="flex items-center justify-end">
                  <span>Price</span>
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="py-3 px-4 font-bold cursor-pointer hover:text-white text-right hidden sm:table-cell" onClick={() => handleSort('change24h')}>
                <div className="flex items-center justify-end">
                  <span>24h Chg</span>
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="py-3 px-4 font-bold cursor-pointer hover:text-white text-center" onClick={() => handleSort('score')}>
                <div className="flex items-center justify-center">
                  <span>Score</span>
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="py-3 px-4 font-bold text-center">Direction</th>
              <th className="py-3 px-4 font-bold cursor-pointer hover:text-white text-center hidden md:table-cell" onClick={() => handleSort('status')}>
                <div className="flex items-center justify-center">
                  <span>Market State</span>
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="py-3 px-4 font-bold text-right hidden lg:table-cell" onClick={() => handleSort('adx')}>
                <div className="flex items-center justify-end">
                  <span>ADX (14)</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold text-right hidden lg:table-cell" onClick={() => handleSort('rsi')}>
                <div className="flex items-center justify-end">
                  <span>RSI (14)</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold text-center hidden lg:table-cell">EMA Setup</th>
              <th className="py-3 px-4 font-bold text-center hidden md:table-cell">Trend</th>
              <th className="py-3 px-4 font-bold text-right hidden sm:table-cell">Vol</th>
              <th className="py-3 px-4 font-bold text-center hidden sm:table-cell">ATR Risk</th>
              <th className="py-3 px-4 font-bold text-center hidden md:table-cell">W/M</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filteredCoins.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-gray-500 font-sans">
                  No coins found matching filters. Try general searching again.
                </td>
              </tr>
            ) : (
              filteredCoins.map((coin) => {
                const isSelected = selectedSymbol === coin.symbol;
                const scoreValue = Math.abs(coin.score);
                const isHighVol = coin.indicators.volumeRatio > 1.5;

                // Highlight active trigger triggers
                const qualifiesAutoTrade = scoreValue >= autoTradeThreshold && coin.status !== 'RANGING';
                let pulseClass = '';
                if (qualifiesAutoTrade) {
                  pulseClass = coin.score > 0
                    ? 'hover:bg-emerald-950/20 bg-emerald-950/10 border-l-2 border-emerald-500 relative transition-all duration-200 shadow-[inset_4px_0_0_0_#10b981]'
                    : 'hover:bg-rose-950/20 bg-rose-950/10 border-l-2 border-rose-500 relative transition-all duration-200 shadow-[inset_4px_0_0_0_#ef4444]';
                } else {
                  pulseClass = isSelected
                    ? 'bg-gray-800/80 hover:bg-gray-800'
                    : 'hover:bg-gray-900/60';
                }

                return (
                  <tr
                    key={coin.symbol}
                    id={`row-${coin.symbol}`}
                    onClick={() => onSelectCoin(coin.symbol)}
                    className={`cursor-pointer transition-colors duration-150 ${pulseClass} text-[11px]`}
                  >
                    {/* Symbol */}
                    <td className="py-2 px-4 font-bold text-gray-100 flex items-center space-x-1">
                      {qualifiesAutoTrade && (
                        <Zap className={`w-3.5 h-3.5 fill-current animate-bounce shrink-0 ${coin.score > 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                      )}
                      <span>{coin.symbol}</span>
                    </td>

                    {/* Price */}
                    <td className="py-2 px-4 text-right font-medium text-gray-300">
                      <PriceFlasher price={coin.price} />
                    </td>

                    {/* Change 24h */}
                    <td className={`py-2 px-4 text-right font-semibold hidden sm:table-cell ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {coin.change24h >= 0 ? '+' : ''}
                      {coin.change24h.toFixed(2)}%
                    </td>

                    {/* Score */}
                    <td className="py-2 px-4 text-center">
                      <span className={`inline-block px-2.1 py-0.5 border rounded-full font-bold text-[10px] min-w-10 text-center ${getScoreColor(coin.score)}`}>
                        {coin.score > 0 ? '+' : ''}
                        {coin.score}
                      </span>
                    </td>

                    {/* Direction */}
                    <td className="py-2 px-4 text-center">
                      {getSignalBadge(coin.direction)}
                    </td>

                    {/* Status badge */}
                    <td className="py-2 px-4 text-center hidden md:table-cell">
                      {getStatusBadge(coin.status)}
                    </td>

                    {/* ADX indicator */}
                    <td className="py-2 px-4 text-right text-gray-400 font-medium hidden lg:table-cell">
                      <span className={coin.indicators.adx.adx > 25 ? 'font-bold text-indigo-400' : 'text-gray-500'}>
                        {coin.indicators.adx.adx.toFixed(1)}
                      </span>
                    </td>

                    {/* RSI indicator */}
                    <td className="py-2 px-4 text-right text-gray-400 font-medium hidden lg:table-cell">
                      <span className={coin.indicators.rsi > 75 || coin.indicators.rsi < 25 ? 'text-amber-500' : 'text-gray-300'}>
                        {coin.indicators.rsi.toFixed(1)}
                      </span>
                    </td>

                    {/* EMA cross check */}
                    <td className="py-2 px-4 text-center text-[10px] hidden lg:table-cell">
                      {coin.indicators.emaFast > coin.indicators.emaSlow ? (
                        <span className="text-emerald-400">FAST &gt; SLOW</span>
                      ) : (
                        <span className="text-rose-400">FAST &lt; SLOW</span>
                      )}
                    </td>

                    {/* SuperTrend direction */}
                    <td className="py-2 px-4 text-center text-[10px] font-bold hidden md:table-cell">
                      {coin.indicators.superTrend.direction === 'uptrend' ? (
                        <span className="text-emerald-400 uppercase">UPTREND</span>
                      ) : (
                        <span className="text-rose-400 uppercase">DOWNTREND</span>
                      )}
                    </td>

                    {/* Volume breakout indicator */}
                    <td className="py-2 px-4 text-right font-medium hidden sm:table-cell">
                      <span className={isHighVol ? 'text-emerald-400 font-bold' : 'text-gray-500'}>
                        {coin.indicators.volumeRatio.toFixed(1)}x
                      </span>
                    </td>

                    {/* ATR Risk (Volatility Warning) */}
                    <td className="py-2 px-4 text-center hidden sm:table-cell">
                      {((coin.indicators.atr / coin.price) * 100) > 3 ? (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold" title={`High ATR: ${((coin.indicators.atr / coin.price) * 100).toFixed(2)}% per candle. Stop-loss risk.`}>
                          <ShieldAlert className="w-3 h-3" />
                          <span>EXTREME</span>
                        </span>
                      ) : (
                         <span className="text-gray-600 text-[10px]">{((coin.indicators.atr / coin.price) * 100).toFixed(1)}%</span>
                      )}
                    </td>

                    {/* W/M Pattern */}
                    <td className="py-2 px-4 text-center text-[10px] font-bold whitespace-nowrap hidden md:table-cell">
                      {coin.wmPattern !== 'NONE' ? (
                        <span className={`${coin.wmPattern.startsWith('W') ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {coin.wmPattern.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
