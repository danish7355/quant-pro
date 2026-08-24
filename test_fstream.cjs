const WebSocket = require('ws');
const ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
ws.on('open', () => console.log('connected fstream !ticker@arr'));
ws.on('message', (data) => {
  console.log('msg received fstream !ticker@arr', data.toString().substring(0, 100));
  process.exit(0);
});
ws.on('error', (e) => console.error(e));
setTimeout(() => { console.log('timeout'); process.exit(1); }, 3000);
