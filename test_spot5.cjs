const WebSocket = require('ws');
const ws = new WebSocket('wss://stream.binance.com/ws/!miniTicker@arr');
ws.on('open', () => console.log('connected spot5'));
ws.on('message', (data) => {
  console.log('msg received spot5', data.toString().substring(0, 100));
  process.exit(0);
});
ws.on('error', (e) => console.error(e));
