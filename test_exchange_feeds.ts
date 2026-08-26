async function testExchangeFeeds() {
  console.log("Testing Multi-Exchange Market Data Feeds...");

  // 1. Binance Futures
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price");
    const data = await res.json();
    const btc = data.find((x: any) => x.symbol === 'BTCUSDT');
    console.log("✅ Binance Futures REST:", btc);
  } catch (e: any) {
    console.error("❌ Binance Futures failed:", e.message);
  }

  // 2. Binance Vision Spot
  try {
    const res = await fetch("https://data-api.binance.vision/api/v3/ticker/price");
    const data = await res.json();
    const btc = data.find((x: any) => x.symbol === 'BTCUSDT');
    console.log("✅ Binance Vision Spot REST:", btc);
  } catch (e: any) {
    console.error("❌ Binance Vision Spot failed:", e.message);
  }

  // 3. Bybit V5 Linear
  try {
    const res = await fetch("https://api.bybit.com/v5/market/tickers?category=linear");
    const data = await res.json();
    const btc = data.result?.list?.find((x: any) => x.symbol === 'BTCUSDT');
    console.log("✅ Bybit V5 Linear REST:", { symbol: btc?.symbol, price: btc?.lastPrice });
  } catch (e: any) {
    console.error("❌ Bybit failed:", e.message);
  }

  // 4. MEXC V3
  try {
    const res = await fetch("https://api.mexc.com/api/v3/ticker/price");
    const data = await res.json();
    const btc = data.find((x: any) => x.symbol === 'BTCUSDT');
    console.log("✅ MEXC V3 REST:", btc);
  } catch (e: any) {
    console.error("❌ MEXC failed:", e.message);
  }

  // 5. Gate.io V4
  try {
    const res = await fetch("https://api.gateio.ws/api/v4/spot/tickers");
    const data = await res.json();
    const btc = data.find((x: any) => x.currency_pair === 'BTC_USDT');
    console.log("✅ Gate.io V4 REST:", { symbol: btc?.currency_pair, price: btc?.last });
  } catch (e: any) {
    console.error("❌ Gate.io failed:", e.message);
  }
}

testExchangeFeeds();
