const https = require('https');

https.get('https://api.binance.com/api/v3/ticker/24hr', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('24hr ticker response:', data.substring(0, 100));
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});

https.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=5', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('klines response:', data.substring(0, 100));
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
