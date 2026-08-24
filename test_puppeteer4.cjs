const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  // Enable request interception to catch 404s
  await page.setRequestInterception(true);
  page.on('request', request => request.continue());
  page.on('response', response => {
    if (response.status() === 404) {
      console.log('404 URL:', response.url());
    }
  });

  page.on('console', msg => {
     console.log('PAGE LOG:', msg.type(), msg.text());
  });
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
