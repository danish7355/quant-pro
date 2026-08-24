/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { runScoringEngine } from './indicators';
import { calculatePositionSize } from './riskManager';
import { manageOpenPositionV3 } from './tradeManager';
import { TradeLog, AppSettings } from '../types';

export interface BacktestResult {
  startingBalance: number;
  finalBalance: number;
  netProfit: number;
  returnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  expectancyUsd: number;
  maxDrawdownPct: number;
  tradeLogs: TradeLog[];
  equityCurve: { time: string; balance: number }[];
}

export function runBacktest(
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[],
  settings: AppSettings,
  symbol: string = 'BTCUSDT'
): BacktestResult {
  let balance = settings.startingBalance;
  let peakBalance = balance;
  let maxDrawdownUsd = 0;
  let maxDrawdownPct = 0;

  const tradeLogs: TradeLog[] = [];
  const equityCurve: { time: string; balance: number }[] = [
    { time: new Date(candles[0]?.time * 1000 || Date.now()).toISOString().split('T')[0], balance }
  ];

  let openPos: {
    entryPrice: number;
    direction: 'LONG' | 'SHORT';
    quantity: number;
    margin: number;
    sl: number;
    tp1: number;
    tp2: number;
    tp3: number;
    timeOpen: string;
    entryBar: number;
    entryAtr: number;
    maxProfitablePrice?: number;
    trailingStop?: number;
    trailingStopActive?: boolean;
    sizeRemainingPct: number;
  } | null = null;

  // Chronological replay with 200 candle warm-up window
  const warmup = 200;
  if (candles.length <= warmup) {
    return {
      startingBalance: settings.startingBalance,
      finalBalance: balance,
      netProfit: 0,
      returnPct: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRatePct: 0,
      profitFactor: 0,
      expectancyUsd: 0,
      maxDrawdownPct: 0,
      tradeLogs: [],
      equityCurve: [{ time: new Date().toISOString(), balance }]
    };
  }

  const feePct = 0.04 / 100; // 0.04% taker fee
  const slippagePct = 0.03 / 100; // 0.03% average slippage

  for (let i = warmup; i < candles.length; i++) {
    const windowCandles = candles.slice(0, i + 1); // Strictly slice up to bar i (NO LOOK-AHEAD)
    const currentBar = candles[i];
    const timeStr = new Date(currentBar.time * 1000).toISOString();

    // Check open position exit on current candle bar
    if (openPos) {
      let closed = false;
      let exitPrice = currentBar.close;
      let exitReason: any = 'MANUAL';
      let partialClose = false;
      let partialRatio = 0;
      let pnlForPartial = 0;

      if (settings.activeStrategy === 'v3' || settings.activeStrategy === 'climax_reversal') {
        const elapsedHours = i - openPos.entryBar; // assuming 1 bar = 1 hour, simplified for backtest
        // We need to cast openPos as Position but it's a minimal object. 
        // Let's create a temporary object that looks like Position.
        const mockPos: any = {
          ...openPos,
          currentPrice: currentBar.close,
          trailingStop: openPos.trailingStop || openPos.sl,
        };
        const result = manageOpenPositionV3(
          mockPos,
          currentBar,
          openPos.entryAtr, // we could calculate current ATR but we'll use entry ATR for simplicity
          elapsedHours,
          settings.timeBasedExitCandles || 12,
          false // watchdogAlert
        );

        if (result.action === 'EXIT') {
          closed = true;
          exitPrice = result.exitPrice || currentBar.close;
          exitReason = result.reason;
        } else if (result.action.startsWith('PARTIAL') && result.partialRatio) {
          partialClose = true;
          exitPrice = result.exitPrice || currentBar.close;
          exitReason = result.reason;
          partialRatio = result.partialRatio;
          
          const rawPnl = openPos.direction === 'LONG'
            ? (exitPrice - openPos.entryPrice) * openPos.quantity * partialRatio
            : (openPos.entryPrice - exitPrice) * openPos.quantity * partialRatio;
            
          const exitFee = openPos.quantity * partialRatio * exitPrice * feePct;
          const entryFee = openPos.quantity * partialRatio * openPos.entryPrice * feePct;
          pnlForPartial = rawPnl - exitFee - entryFee;
          
          openPos.sizeRemainingPct = result.updatedPosition.sizeRemainingPct!;
          openPos.quantity = openPos.quantity * (1 - partialRatio); // reduce quantity
          openPos.margin = openPos.margin * (1 - partialRatio); // reduce margin
          balance += (openPos.margin * (partialRatio / (1 - partialRatio))) + pnlForPartial; // this might be inaccurate but simplifies tracking.
          
          tradeLogs.push({
            id: Math.random().toString(36).substr(2, 9),
            symbol: 'BACKTEST',
            direction: openPos.direction,
            entryPrice: openPos.entryPrice,
            closePrice: exitPrice,
            leverage: settings.leverage,
            profit: pnlForPartial,
            pctReturn: (pnlForPartial / (openPos.margin * (partialRatio / (1 - partialRatio)))) * 100,
            exitReason: exitReason,
            timeOpen: openPos.timeOpen,
            timeClose: timeStr,
            scoreAtEntry: 0,
            scoreAtClose: 0
          });
        }
        
        // update trailing stop and max profitable price
        openPos.trailingStop = result.updatedPosition.trailingStop;
        openPos.trailingStopActive = result.updatedPosition.trailingStopActive;
        openPos.maxProfitablePrice = result.updatedPosition.maxProfitablePrice;
        
      } else {
        if (openPos.direction === 'LONG') {
          if (currentBar.low <= openPos.sl) {
            closed = true;
            exitPrice = openPos.sl * (1 - slippagePct);
            exitReason = 'SL';
          } else if (currentBar.high >= openPos.tp3) {
            closed = true;
            exitPrice = openPos.tp3 * (1 - slippagePct);
            exitReason = 'TP3';
          } else if (i - openPos.entryBar >= (settings.timeBasedExitCandles || 12)) {
            closed = true;
            exitPrice = currentBar.close * (1 - slippagePct);
            exitReason = 'TIME_EXIT';
          }
        } else {
          if (currentBar.high >= openPos.sl) {
            closed = true;
            exitPrice = openPos.sl * (1 + slippagePct);
            exitReason = 'SL';
          } else if (currentBar.low <= openPos.tp3) {
            closed = true;
            exitPrice = openPos.tp3 * (1 + slippagePct);
            exitReason = 'TP3';
          } else if (i - openPos.entryBar >= (settings.timeBasedExitCandles || 12)) {
            closed = true;
            exitPrice = currentBar.close * (1 - slippagePct);
            exitReason = 'TIME_EXIT';
          }
        }
      }

      if (closed) {
        const rawPnl = openPos.direction === 'LONG'
          ? (exitPrice - openPos.entryPrice) * openPos.quantity
          : (openPos.entryPrice - exitPrice) * openPos.quantity;
        
        const entryFee = openPos.quantity * openPos.entryPrice * feePct;
        const exitFee = openPos.quantity * exitPrice * feePct;
        const netTradeProfit = rawPnl - entryFee - exitFee;

        balance += openPos.margin + netTradeProfit;
        if (balance > peakBalance) peakBalance = balance;
        const dd = peakBalance - balance;
        if (dd > maxDrawdownUsd) {
          maxDrawdownUsd = dd;
          maxDrawdownPct = (maxDrawdownUsd / peakBalance) * 100;
        }

        tradeLogs.push({
          id: `bt_${i}`,
          symbol,
          direction: openPos.direction,
          entryPrice: openPos.entryPrice,
          closePrice: exitPrice,
          leverage: settings.leverage,
          profit: netTradeProfit,
          pctReturn: (netTradeProfit / openPos.margin) * 100,
          exitReason,
          timeOpen: openPos.timeOpen,
          timeClose: timeStr,
          scoreAtEntry: 70,
          scoreAtClose: 0
        });

        equityCurve.push({ time: timeStr.split('T')[0], balance });
        openPos = null;
      }
    }

    // Evaluate potential new entry if no open position
    if (!openPos) {
      const scoring = runScoringEngine(windowCandles, {
        activeStrategy: settings.activeStrategy,
        emaFastPeriod: settings.emaFastPeriod,
        emaSlowPeriod: settings.emaSlowPeriod,
        emaTrendPeriod: settings.emaTrendPeriod,
        rsiPeriod: settings.rsiPeriod,
        rsiLongMax: settings.rsiLongMax,
        rsiLongMin: settings.rsiLongMin,
        macdFast: settings.macdFast,
        macdSlow: settings.macdSlow,
        macdSignal: settings.macdSignal,
        adxPeriod: settings.adxPeriod,
        adxTrendThreshold: settings.adxTrendThreshold,
        superTrendPeriod: settings.superTrendPeriod,
        superTrendMultiplier: settings.superTrendMultiplier,
        volumeMultiplier: settings.volumeMultiplier,
        fibLookback: settings.fibLookback,
        atrPeriod: settings.atrPeriod,
        slAtrMultiple: settings.slAtrMultiple,
      });

      if (scoring.reason === 'All gates passed' && scoring.score >= settings.autoTradeThreshold) {
        const atr = scoring.indicators.atr || currentBar.close * 0.02;
        const slDist = atr * settings.slAtrMultiple;
        const isLong = scoring.direction === 'LONG';
        const entryPrice = isLong ? currentBar.close * (1 + slippagePct) : currentBar.close * (1 - slippagePct);
        const sl = isLong ? entryPrice - slDist : entryPrice + slDist;
        const tp1 = isLong ? entryPrice + atr * settings.tp1AtrMultiple : entryPrice - atr * settings.tp1AtrMultiple;

        const tp2 = isLong ? entryPrice + atr * settings.tp2AtrMultiple : entryPrice - atr * settings.tp2AtrMultiple;
        const tp3 = isLong 
          ? tp2 + atr * settings.tp2AtrMultiple * settings.tp3FibLevel
          : tp2 - atr * settings.tp2AtrMultiple * settings.tp3FibLevel;

        const sizeRes = calculatePositionSize(
          balance,
          settings.accountRiskPct,
          settings.positionSizePct,
          entryPrice,
          sl,
          settings.leverage
        );

        if (sizeRes.allowed && sizeRes.quantity > 0) {
          balance -= sizeRes.allocatedMargin;
          openPos = {
            entryPrice,
            direction: scoring.direction as 'LONG' | 'SHORT',
            quantity: sizeRes.quantity,
            margin: sizeRes.allocatedMargin,
            sl,
            tp1,
            tp2,
            tp3,
            timeOpen: timeStr,
            entryBar: i,
            entryAtr: atr,
            sizeRemainingPct: 100
          };
        }
      }
    }
  }

  const winningTrades = tradeLogs.filter(t => t.profit > 0);
  const losingTrades = tradeLogs.filter(t => t.profit <= 0);
  const grossWin = winningTrades.reduce((acc, t) => acc + t.profit, 0);
  const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.profit, 0));
  const profitFactor = grossLoss === 0 ? grossWin : grossWin / grossLoss;
  const winRatePct = tradeLogs.length === 0 ? 0 : (winningTrades.length / tradeLogs.length) * 100;
  const netProfit = balance - settings.startingBalance;
  const expectancyUsd = tradeLogs.length === 0 ? 0 : netProfit / tradeLogs.length;

  return {
    startingBalance: settings.startingBalance,
    finalBalance: balance,
    netProfit,
    returnPct: (netProfit / settings.startingBalance) * 100,
    totalTrades: tradeLogs.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRatePct,
    profitFactor,
    expectancyUsd,
    maxDrawdownPct,
    tradeLogs,
    equityCurve
  };
}
