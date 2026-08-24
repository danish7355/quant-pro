const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  console.log('HTML length:', html.length);
  await browser.close();
})();
