const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
     if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('ERROR') || msg.text().includes('UNHANDLED')) {
         console.log('PAGE LOG:', msg.text());
     }
  });
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
})();
