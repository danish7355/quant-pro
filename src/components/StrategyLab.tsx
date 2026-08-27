/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sliders, Shield, Zap, CheckCircle2, XCircle, Info, RefreshCw } from 'lucide-react';
import { AppSettings } from '../types';

interface StrategyLabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export default function StrategyLab({ settings, onUpdateSettings }: StrategyLabProps) {
  // Gate Sandbox Input State
  const [sandboxInputs, setSandboxInputs] = useState({
    liquidityUsd: 15000000,
    spreadPct: 0.08,
    regimeScore: 75,
    adxValue: 28,
    atrPct: 1.8,
    rsiValue: 52,
    breakoutConfirmed: true,
    volumeMultiplier: 1.8,
    fundingRate: 0.0001,
    rrRatio: 1.8
  });

  // Calculate sandbox gate evaluation
  const g1 = sandboxInputs.liquidityUsd >= settings.min24hVolume;
  const g2 = sandboxInputs.spreadPct <= settings.maxSpread;
  const g3 = sandboxInputs.regimeScore >= 60;
  const g4 = sandboxInputs.adxValue >= settings.adxTrendThreshold;
  const g5 = sandboxInputs.atrPct >= 0.3 && sandboxInputs.atrPct <= 6.0;
  const g6 = sandboxInputs.rsiValue >= settings.rsiLongMin && sandboxInputs.rsiValue <= settings.rsiLongMax;
  const g7 = sandboxInputs.breakoutConfirmed;
  const g8 = sandboxInputs.volumeMultiplier >= settings.volumeMultiplier;
  const g9 = Math.abs(sandboxInputs.fundingRate) <= settings.maxFundingRate;
  const g10 = sandboxInputs.rrRatio >= settings.minRRRatio;

  const mandatoryPass = g1 && g2 && g3 && g4 && g5 && g8 && g9;
  const confCount = (g6 ? 1 : 0) + (g7 ? 1 : 0) + (g10 ? 1 : 0);
  const overallEntryAllowed = mandatoryPass && confCount >= 2;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-gray-200">
      {/* Strategy Switcher */}
      <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-200">Active Trading Engine</h2>
          <p className="text-xs text-gray-500 mt-1">Select which algorithmic strategy module governs automated entry generation.</p>
        </div>
        <div className="flex flex-wrap bg-[#0f172a] rounded p-1 border border-[#30363D] gap-1">
          {[
            { id: 'v2', label: 'MODULE V2 (SMC)' },
            { id: 'v3', label: 'MODULE V3 (SMC + EMA/BB)' },
            { id: 'climax_reversal', label: 'CLIMAX REVERSAL' },
            { id: 'volatility_compression_breakout', label: 'VOLATILITY COMPRESSION BREAKOUT' }
          ].map((strat) => (
            <button
              key={strat.id}
              onClick={() => onUpdateSettings({ ...settings, activeStrategy: strat.id })}
              className={`px-4 py-2 rounded text-xs font-bold transition-all ${
                settings.activeStrategy === strat.id 
                  ? 'bg-emerald-500 text-[#0f172a]' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {strat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
            <Sliders size={16} /> 10-GATE STRATEGY LAB & MATRIX CUSTOMIZER
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Test and tweak gate pass conditions interactively before applying them to live/paper scanning.
          </p>
        </div>

        <div className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 border ${
          overallEntryAllowed 
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
        }`}>
          {overallEntryAllowed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {overallEntryAllowed ? 'SANDBOX SIGNAL PASSED' : 'SANDBOX SIGNAL REJECTED'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sandbox Controls */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Zap size={14} className="text-amber-400" /> Interactive Gate Input Sandbox
          </h4>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">24h Liquidity ($): {sandboxInputs.liquidityUsd.toLocaleString()}</label>
              <input
                type="range"
                min="1000000"
                max="50000000"
                step="1000000"
                value={sandboxInputs.liquidityUsd}
                onChange={(e) => setSandboxInputs({ ...sandboxInputs, liquidityUsd: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Spread (%): {sandboxInputs.spreadPct}%</label>
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={sandboxInputs.spreadPct}
                onChange={(e) => setSandboxInputs({ ...sandboxInputs, spreadPct: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Regime Score (0-100): {sandboxInputs.regimeScore}</label>
              <input
                type="range"
                min="0"
                max="100"
                value={sandboxInputs.regimeScore}
                onChange={(e) => setSandboxInputs({ ...sandboxInputs, regimeScore: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">ADX Value: {sandboxInputs.adxValue}</label>
              <input
                type="range"
                min="5"
                max="60"
                value={sandboxInputs.adxValue}
                onChange={(e) => setSandboxInputs({ ...sandboxInputs, adxValue: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Volume Multiplier: {sandboxInputs.volumeMultiplier}x</label>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={sandboxInputs.volumeMultiplier}
                onChange={(e) => setSandboxInputs({ ...sandboxInputs, volumeMultiplier: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Risk:Reward Ratio: {sandboxInputs.rrRatio}R</label>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={sandboxInputs.rrRatio}
                onChange={(e) => setSandboxInputs({ ...sandboxInputs, rrRatio: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Gate Matrix Verification Panel */}
        <div className="lg:col-span-2 bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Shield size={14} className="text-blue-400" /> 10-Gate Evaluation Breakdown Matrix
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Gate 1 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g1 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              <div>
                <span className="font-bold">Gate 1: Liquidity Filter</span>
                <span className="block text-[10px] text-gray-400">Min: ${settings.min24hVolume.toLocaleString()}</span>
              </div>
              {g1 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 2 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g2 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              <div>
                <span className="font-bold">Gate 2: Spread Filter</span>
                <span className="block text-[10px] text-gray-400">Max: {settings.maxSpread}%</span>
              </div>
              {g2 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 3 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g3 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              <div>
                <span className="font-bold">Gate 3: Regime Score</span>
                <span className="block text-[10px] text-gray-400">Min: 60 Score</span>
              </div>
              {g3 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 4 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g4 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              <div>
                <span className="font-bold">Gate 4: Trend Alignment & ADX</span>
                <span className="block text-[10px] text-gray-400">Min ADX: {settings.adxTrendThreshold}</span>
              </div>
              {g4 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 5 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g5 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              <div>
                <span className="font-bold">Gate 5: Volatility Bounds</span>
                <span className="block text-[10px] text-gray-400">ATR%: 0.3% - 6.0%</span>
              </div>
              {g5 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 6 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g6 ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
              <div>
                <span className="font-bold">Gate 6: Momentum (RSI) [Confirm]</span>
                <span className="block text-[10px] text-gray-400">Window: {settings.rsiLongMin}-{settings.rsiLongMax}</span>
              </div>
              {g6 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 7 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g7 ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
              <div>
                <span className="font-bold">Gate 7: Structure Breakout [Confirm]</span>
                <span className="block text-[10px] text-gray-400">High/Low Swing or Pattern</span>
              </div>
              {g7 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 8 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g8 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              <div>
                <span className="font-bold">Gate 8: Volume Surge</span>
                <span className="block text-[10px] text-gray-400">Min Vol Multiplier: {settings.volumeMultiplier}x</span>
              </div>
              {g8 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 9 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g9 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              <div>
                <span className="font-bold">Gate 9: Funding Rate Cap</span>
                <span className="block text-[10px] text-gray-400">Max Funding: {settings.maxFundingRate}%</span>
              </div>
              {g9 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>

            {/* Gate 10 */}
            <div className={`p-3 rounded border flex items-center justify-between ${g10 ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
              <div>
                <span className="font-bold">Gate 10: Min R:R Ratio [Confirm]</span>
                <span className="block text-[10px] text-gray-400">Min R:R: {settings.minRRRatio}R</span>
              </div>
              {g10 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
