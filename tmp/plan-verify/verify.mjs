import { launch } from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const chrome =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = resolve(process.cwd(), '..');
mkdirSync(outDir, { recursive: true });

const browser = await launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--use-gl=angle', '--hide-scrollbars'],
});

async function freshPage(width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('plan_alien_heard_v1', '1');
  });
  return page;
}

async function measure(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.plan-stage');
    const hud = document.querySelector('.plan-hud');
    const mast = document.querySelector('.plan-masthead');
    const wrap = document.querySelector('.plan-wrap');
    const sidebar = document.querySelector('.plan-sidebar');
    const dock = document.querySelector('.plan-dock');
    const lede = document.querySelector('.plan-masthead__lede');
    const title = document.querySelector('.plan-sidebar__title')?.textContent?.trim();
    const splash = document.documentElement.classList.contains('is-intro-splash');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        visible: r.width > 0 && r.height > 0,
      };
    };
    const ids = [
      'planDate',
      'planTime',
      'planNow',
      'planTonight',
      'planPlay',
      'planSpeed',
      'planFacing',
      'planLookUp',
      'planLinesToggle',
      'planNightVision',
      'planGeolocate',
      'planShare',
      'planAmbienceToggle',
      'planAskCarl',
      'planDockCarl',
      'planDockPlay',
      'planDockDesk',
      'planFullscreen',
    ];
    return {
      splash,
      title,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      stage: rect(stage),
      hud: rect(hud),
      mast: rect(mast),
      wrap: rect(wrap),
      sidebar: rect(sidebar),
      dock: rect(dock),
      dockDisplay: dock ? getComputedStyle(dock).display : null,
      ledeHidden: !lede || getComputedStyle(lede).position === 'absolute',
      skyRatio: stage ? +(stage.getBoundingClientRect().height / window.innerHeight).toFixed(3) : 0,
      ids: Object.fromEntries(ids.map((id) => [id, !!document.getElementById(id)])),
    };
  });
}

const report = {};

const desktop = await freshPage(1280, 800);
await desktop.goto('http://localhost:3000/planetarium/', { waitUntil: 'networkidle0', timeout: 45000 });
await desktop.waitForSelector('.plan-stage', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));
report.desktop = await measure(desktop);
await desktop.screenshot({ path: resolve(outDir, 'theater-desktop.png'), fullPage: false });

await desktop.click('#planNow');
await new Promise((r) => setTimeout(r, 300));
const controlsOpen = await desktop.$eval('.plan-hud__more', (el) => el.open);
if (!controlsOpen) {
  await desktop.click('.plan-hud__toggle');
  await new Promise((r) => setTimeout(r, 250));
}
report.desktop.controlsOpen = await desktop.$eval('.plan-hud__more', (el) => el.open);
report.desktop.nowClicked = true;
await desktop.screenshot({ path: resolve(outDir, 'theater-desktop-controls.png'), fullPage: false });

await desktop.click('#planLookUp');
await new Promise((r) => setTimeout(r, 200));
report.desktop.lookUpPressed = await desktop.$eval('#planLookUp', (el) => el.getAttribute('aria-pressed'));

await desktop.click('#planAskCarl');
await new Promise((r) => setTimeout(r, 400));
report.desktop.askCarlPresent = await desktop.$eval('#planAskCarl', (el) => !!el);

const phone = await freshPage(390, 844);
await phone.goto('http://localhost:3000/planetarium/', { waitUntil: 'networkidle0', timeout: 45000 });
await phone.waitForSelector('.plan-stage', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1200));
report.phone = await measure(phone);
await phone.screenshot({ path: resolve(outDir, 'theater-phone.png'), fullPage: false });

const deskBtn = await phone.$('#planDockDesk');
if (deskBtn) {
  await deskBtn.click();
  await new Promise((r) => setTimeout(r, 400));
  report.phone.deskOpen = await phone.$eval('#planSidebar', (el) => el.classList.contains('is-open'));
  await phone.screenshot({ path: resolve(outDir, 'theater-phone-desk.png'), fullPage: false });
}

const field = await freshPage(390, 844);
await field.goto('http://localhost:3000/planetarium/field.html', { waitUntil: 'networkidle0', timeout: 45000 });
await field.waitForSelector('.plan-stage--field', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1000));
report.field = await field.evaluate(() => {
  const stage = document.querySelector('.plan-stage--field');
  const r = stage.getBoundingClientRect();
  return {
    bodyClass: document.body.className,
    stage: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) },
    skyRatio: +(r.height / window.innerHeight).toFixed(3),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    hasTheaterHud: !!document.querySelector('.plan-hud'),
    hasFieldHud: !!document.querySelector('.plan-field-hud'),
    hasFieldDock: !!document.querySelector('.plan-field-dock'),
  };
});
await field.screenshot({ path: resolve(outDir, 'field-phone.png'), fullPage: false });

await browser.close();
console.log(JSON.stringify(report, null, 2));
