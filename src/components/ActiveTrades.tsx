/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Position } from '../types';
import { TrendingUp, TrendingDown, Target, Shield, Clock, X, Anchor } from 'lucide-react';
import { PriceFlasher } from './PriceFlasher';

interface ActiveTradesProps {
  positions: Position[];
  onManualClose: (id: string) => void;
}

export default function ActiveTrades({ positions, onManualClose }: ActiveTradesProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h2 className="text-lg font-bold text-gray-100 tracking-tight">Active Futures Positions</h2>
        </div>
        <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full">
          {positions.length} Open Trades
        </span>
      </div>

      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-gray-800 rounded-lg text-gray-500">
          <Clock className="w-8 h-8 mb-2 stroke-gray-600" />
          <p className="text-sm font-medium">No open positions at the moment</p>
          <span className="text-xs text-gray-600 mt-1 max-w-xs text-center">
            When a coin's score reaches ≥80 and auto-trade is enabled, a trade will trigger automatically.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {positions.map((pos) => {
            const isLong = pos.direction === 'LONG';
            const unrealizedPnlVal = pos.unrealizedPnl;
            const pnlColorClass = unrealizedPnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400';
            const pnlBgClass = unrealizedPnlVal >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10';

            const elapsedMinutes = Math.floor((Date.now() - new Date(pos.timeOpen).getTime()) / 60000);
            const sizeRemaining = pos.sizeRemainingPct;

            return (
              <div
                key={pos.id}
                id={`pos-${pos.symbol}`}
                className="relative bg-gray-950/60 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all duration-200 overflow-hidden shadow-inner flex flex-col justify-between"
              >
                {/* Visual side accent */}
                <div
                  className={`absolute top-0 bottom-0 left-0 w-1 ${
                    isLong ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />

                <div>
                  {/* Header Row */}
                  <div className="flex items-center justify-between pl-1.5 mb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-100 font-mono tracking-tight text-md">
                        {pos.symbol}
                      </span>
                      <span className="text-[10px] bg-gray-800 text-gray-400 font-mono px-1.5 py-0.5 rounded">
                        {pos.leverage}x
                      </span>
                      <span
                        className={`flex items-center space-x-0.5 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isLong
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isLong ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>{isLong ? 'LONG' : 'SHORT'}</span>
                      </span>
                    </div>

                    <button
                      onClick={() => onManualClose(pos.id)}
                      className="p-1 text-gray-500 hover:text-rose-400 hover:bg-gray-800/60 rounded-full transition-all"
                      title="Market Exit"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Pricing and PNL */}
                  <div className="grid grid-cols-2 gap-2 mb-3.5 pl-1.5">
                    <div className="bg-gray-900/40 p-2 rounded border border-gray-800/45">
                      <span className="text-[10px] text-gray-500 uppercase block font-medium">
                        Entry Price
                      </span>
                      <span className="text-sm font-semibold text-gray-300 font-mono">
                        ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                      </span>
                    </div>

                    <div className="bg-gray-900/40 p-2 rounded border border-gray-800/45">
                      <span className="text-[10px] text-gray-500 uppercase block font-medium">
                        Mark Price
                      </span>
                      <span className="text-sm font-semibold text-gray-100 font-mono">
                        <PriceFlasher price={pos.currentPrice} />
                      </span>
                    </div>
                  </div>

                  {/* Live Profit & Loss Panel */}
                  <div className={`p-3 rounded-lg ${pnlBgClass} border border-gray-800/50 mb-3.5 flex items-center justify-between`}>
                    <div>
                      <span className="text-[11px] text-gray-400 font-medium block">
                        Unrealized Profit/Loss
                      </span>
                      <span className={`text-xl font-bold font-mono tracking-tight ${pnlColorClass}`}>
                        {unrealizedPnlVal >= 0 ? '+' : ''}
                        ${unrealizedPnlVal.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block font-medium">Return %</span>
                      <span className={`text-sm font-bold font-mono ${pnlColorClass}`}>
                        {isLong
                          ? (((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.leverage).toFixed(2)
                          : (((pos.entryPrice - pos.currentPrice) / pos.entryPrice) * 100 * pos.leverage).toFixed(2)}
                        %
                      </span>
                    </div>
                  </div>

                  {/* Details / Metrics */}
                  <div className="space-y-2 font-mono text-[11px] text-gray-400 pl-1 mb-4">
                    <div className="flex justify-between items-center bg-gray-900/10 py-0.5">
                      <span className="text-gray-500 flex items-center space-x-1">
                        <Anchor className="w-3 h-3 mr-1" /> Size (USD)
                      </span>
                      <span className="text-gray-300 font-semibold">
                        ${pos.allocatedBalance.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-gray-900/10 py-0.5">
                      <span className="text-gray-500 flex items-center space-x-1">
                        <Clock className="w-3 h-3 mr-1" /> Open Duration
                      </span>
                      <span className="text-gray-300">
                        {elapsedMinutes}m ago
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-gray-900/10 py-0.5">
                      <span className="text-gray-500">Score at Entry</span>
                      <span className="text-gray-300 font-semibold">
                        {pos.scoreAtEntry}
                      </span>
                    </div>

                    {pos.trailingStop !== null && (
                      <div className="flex justify-between items-center bg-amber-500/5 text-amber-400 p-1.5 rounded border border-amber-500/10">
                        <span>Trailing Stop Limit</span>
                        <span className="font-semibold">
                          ${pos.trailingStop.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Targets Slider / Status List */}
                <div className="border-t border-gray-800/80 pt-3">
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase mb-1.5">
                    Target Levels Progress
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="flex items-center justify-between bg-gray-900/40 p-1.5 rounded">
                      <span className="text-gray-500 flex items-center">
                        <Shield className="w-2.5 h-2.5 mr-1 stroke-rose-400" /> SL
                      </span>
                      <span className="text-rose-300">
                        ${pos.sl.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 8 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-gray-900/40 p-1.5 rounded">
                      <span className="text-gray-500 flex items-center">
                        <Target className="w-2.5 h-2.5 mr-1 stroke-emerald-400" /> TP1 (40%)
                      </span>
                      <span className={`text-emerald-300 ${sizeRemaining <= 60 ? 'line-through text-gray-500 font-normal' : ''}`}>
                        ${pos.tp1.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 8 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-gray-900/40 p-1.5 rounded">
                      <span className="text-gray-500 flex items-center">
                        <Target className="w-2.5 h-2.5 mr-1 stroke-emerald-400" /> TP2 (40%)
                      </span>
                      <span className={`text-emerald-300 ${sizeRemaining <= 20 ? 'line-through text-gray-500 font-normal' : ''}`}>
                        ${pos.tp2.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 8 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-gray-900/40 p-1.5 rounded">
                      <span className="text-gray-500 flex items-center">
                        <Target className="w-2.5 h-2.5 mr-1 stroke-cyan-400" /> TP3 (20%)
                      </span>
                      <span className="text-cyan-300">
                        ${pos.tp3.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 8 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
