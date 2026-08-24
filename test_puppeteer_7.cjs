const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
     if (msg.type() === 'error') {
         console.log('PAGE ERROR LOG:', msg.text(), msg.location());
     }
  });
  page.on('pageerror', err => {
     console.log('PAGE ERROR EXCEPTION:', err.toString(), err.stack);
  });
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
