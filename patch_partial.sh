sed -i '/const closePosition/i \
  const closePartialPosition = (pos: Position, reason: TradeLog["exitReason"], partialRatio: number) => {\
    if (!positionsRef.current.some(p => p.id === pos.id)) return;\
    const pnl = pos.unrealizedPnl * partialRatio;\
    const marginFreed = pos.allocatedBalance * partialRatio;\
    balanceRef.current += (marginFreed + pnl);\
    setBalance(b => b + marginFreed + pnl);\
    const log: TradeLog = {\
      id: Math.random().toString(36).substr(2, 9),\
      symbol: pos.symbol,\
      direction: pos.direction,\
      entryPrice: pos.entryPrice,\
      closePrice: pos.currentPrice,\
      leverage: pos.leverage,\
      profit: pnl,\
      pctReturn: (pnl / marginFreed) * 100,\
      exitReason: reason,\
      timeOpen: pos.timeOpen,\
      timeClose: new Date().toISOString(),\
      scoreAtEntry: pos.scoreAtEntry,\
      scoreAtClose: 0\
    };\
    setTradeLogs(prev => [log, ...prev]);\
    setEquitySnapshots(prev => [...prev, { time: new Date().toISOString(), balance: balanceRef.current }]);\
    addTerminalLog(`🔸 PARTIAL CLOSED ${pos.symbol} [${reason}] PNL: $${pnl.toLocaleString(undefined, { maximumFractionDigits: 8 })}`);\
  };\
' src/App.tsx
