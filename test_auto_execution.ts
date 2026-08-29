import { state, scanMarkets } from './src/server/engine';

async function testAutoExecution() {
  console.log("====================================================================");
  console.log("          TESTING LIVE AUTO-TRADE SCAN & EXECUTION CYCLE            ");
  console.log("====================================================================\n");

  state.settings.autoTradeEnabled = true;
  state.settings.autoTradeThreshold = 55; // Lower threshold to ensure trade fires on live data
  state.settings.timeframe = '15m';
  state.settings.activeStrategy = 'climax_reversal';
  state.settings.coinCount = 50;
  state.positions = []; // start with 0 positions
  state.balance = 10000;

  console.log(`Starting scan with strategy: ${state.settings.activeStrategy}, threshold: ${state.settings.autoTradeThreshold}, coins: ${state.settings.coinCount}...`);
  
  await scanMarkets();

  console.log(`\nScan finished. Total coins scanned: ${state.coins.length}`);
  console.log(`Positions opened: ${state.positions.length}`);

  for (const pos of state.positions) {
    console.log(`  >>> OPEN POSITION: ${pos.direction} on ${pos.symbol} at $${pos.entryPrice} | SL: $${pos.sl.toFixed(4)} | TP1: $${pos.tp1.toFixed(4)} | Qty: ${pos.quantity.toFixed(4)} | Margin: $${pos.allocatedBalance.toFixed(2)}`);
  }

  console.log("\nTerminal logs generated:");
  for (const log of state.terminalLogs.slice(0, 10)) {
    console.log(`  ${log}`);
  }

  console.log("\n====================================================================");
  if (state.positions.length > 0) {
    console.log("  ✅ SUCCESS: Auto-trade executed and opened live positions!");
  } else {
    console.log("  ℹ️ No positions opened — check candidate scores above threshold");
  }
  console.log("====================================================================");
}

testAutoExecution().catch(console.error);
