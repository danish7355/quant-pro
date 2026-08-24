const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
     if (msg.type() === 'error' || msg.text().includes('ERROR')) {
         console.log('PAGE ERROR:', msg.text());
     }
  });
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  
  // click through tabs
  const buttons = await page.$$('nav button');
  for (let btn of buttons) {
      await btn.click();
      await new Promise(r => setTimeout(r, 500));
  }
  
  await browser.close();
})();
