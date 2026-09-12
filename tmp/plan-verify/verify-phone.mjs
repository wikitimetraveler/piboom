import { launch } from 'puppeteer-core';
import { resolve } from 'node:path';

const browser = await launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('plan_alien_heard_v1', '1');
});
await page.goto('http://localhost:3000/planetarium/', { waitUntil: 'networkidle0', timeout: 45000 });
await page.waitForSelector('.plan-hud__rail');
await new Promise((r) => setTimeout(r, 800));
const hud = await page.$eval('.plan-hud', (el) => {
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
});
const stage = await page.$eval('.plan-stage', (el) => {
  const r = el.getBoundingClientRect();
  return { h: Math.round(r.height), ratio: +(r.height / window.innerHeight).toFixed(3) };
});
await page.screenshot({ path: resolve(process.cwd(), '..', 'theater-phone.png'), fullPage: false });
await browser.close();
console.log(JSON.stringify({ hud, stage }, null, 2));
