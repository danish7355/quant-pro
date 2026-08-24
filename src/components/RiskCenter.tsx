/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { DollarSign, Percent } from 'lucide-react';
import { AppSettings, Position } from '../types';
import { calculatePositionSize } from '../utils/riskManager';

interface RiskCenterProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  balance: number;
  positions: Position[];
  onManualClose: (id: string) => void;
  setEngineRunning: (running: boolean) => void;
}

export default function RiskCenter({
  settings,
  onUpdateSettings,
  balance,
  positions,
  onManualClose,
  setEngineRunning
}: RiskCenterProps) {
  // Calculator Sandbox State
  const [calcEntry, setCalcEntry] = useState(65000);
  const [calcSl, setCalcSl] = useState(64000);
  
  const calcRes = calculatePositionSize(
    balance,
    settings.accountRiskPct,
    settings.positionSizePct,
    calcEntry,
    calcSl,
    settings.leverage
  );

  const totalPositionValue = positions.reduce((sum, p) => sum + (p.quantity * p.currentPrice), 0);
  const totalAllocatedMargin = positions.reduce((sum, p) => sum + p.allocatedBalance, 0);
  const currentExposurePct = balance > 0 ? (totalPositionValue / balance) * 100 : 0;
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-gray-200">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Sandbox Calculator */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={14} className="text-emerald-400" /> Position Sizing Calculator
          </h4>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 block mb-1">Entry Price</label>
                <input
                  type="number"
                  value={calcEntry}
                  onChange={(e) => setCalcEntry(Number(e.target.value))}
                  className="w-full bg-[#0E1117] border border-[#30363D] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Stop Loss</label>
                <input
                  type="number"
                  value={calcSl}
                  onChange={(e) => setCalcSl(Number(e.target.value))}
                  className="w-full bg-[#0E1117] border border-[#30363D] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 block mb-1">Account Risk (%)</label>
                <input
                  type="number"
                  value={settings.accountRiskPct}
                  onChange={(e) => onUpdateSettings({ ...settings, accountRiskPct: Number(e.target.value) })}
                  className="w-full bg-[#0E1117] border border-[#30363D] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Position Size (% of Balance)</label>
                <input
                  type="number"
                  value={settings.positionSizePct}
                  onChange={(e) => onUpdateSettings({ ...settings, positionSizePct: Number(e.target.value) })}
                  className="w-full bg-[#0E1117] border border-[#30363D] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            
            <div className="p-3 bg-[#0E1117] border border-[#30363D] rounded-lg space-y-2">
              <span className="text-[10px] text-gray-500 uppercase block font-bold">Calculation Results</span>
              <div className="flex justify-between">
                <span className="text-gray-400">Allowed by Risk Rules:</span>
                <span className={`font-bold ${calcRes.allowed ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {calcRes.allowed ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Position Size USD:</span>
                <span className="font-bold text-emerald-400">${calcRes.positionSizeUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Required Margin:</span>
                <span className="font-bold text-blue-400">${calcRes.allocatedMargin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Contracts Quantity:</span>
                <span className="font-bold text-purple-400">{calcRes.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>
              </div>
              {!calcRes.allowed && (
                <div className="text-rose-400 text-[10px] mt-1 italic">Reason: {calcRes.reason}</div>
              )}
            </div>
          </div>
        </div>

        {/* Global Risk Guardrails */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Percent size={14} className="text-purple-400" /> Account Guardrails & Risk Caps
          </h4>
          
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">Max Concurrent Trades</label>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.maxConcurrentTrades}
                onChange={(e) => onUpdateSettings({ ...settings, maxConcurrentTrades: Number(e.target.value) })}
                className="w-full bg-[#0E1117] border border-[#30363D] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div>
              <label className="text-gray-400 block mb-1">Daily Loss Limit Halt (%)</label>
              <input
                type="number"
                step="0.5"
                value={settings.dailyLossLimitPct}
                onChange={(e) => onUpdateSettings({ ...settings, dailyLossLimitPct: Number(e.target.value) })}
                className="w-full bg-[#0E1117] border border-[#30363D] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Max Drawdown Limit Halt (%)</label>
              <input
                type="number"
                step="1"
                value={settings.maxDrawdownPct}
                onChange={(e) => onUpdateSettings({ ...settings, maxDrawdownPct: Number(e.target.value) })}
                className="w-full bg-[#0E1117] border border-[#30363D] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div>
              <label className="text-gray-400 block mb-1">Leverage Cap (1x = Paper No Leverage)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.leverage}
                onChange={(e) => onUpdateSettings({ ...settings, leverage: Number(e.target.value) })}
                className="w-full bg-[#0E1117] border border-[#30363D] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
