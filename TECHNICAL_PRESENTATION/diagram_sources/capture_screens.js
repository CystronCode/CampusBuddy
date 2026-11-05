'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('../../frontend-next/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const outDir = path.resolve(__dirname, '..', '04_PRODUCT_DEPLOYMENT', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Navigating to live app...');
  await page.goto('https://campusos-mvp.vercel.app', { waitUntil: 'networkidle', timeout: 35000 });
  await page.screenshot({ path: path.join(outDir, '01_login_view.png') });
  console.log('1. Login captured');

  // Fill student demo login
  for (const b of await page.$$('button')) {
    const t = await b.innerText();
    if (t.includes('STUDENT')) {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(500);

  // Click Sign In
  for (const b of await page.$$('button')) {
    const t = await b.innerText();
    if (t.includes('Sign In')) {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outDir, '02_student_dashboard.png') });
  console.log('2. Student dashboard captured');

  // Click 'Ask CampusOS'
  for (const b of await page.$$('button, a')) {
    const t = (await b.innerText()).trim();
    if (t === 'Ask CampusOS' || t === 'Ask') {
      await b.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(outDir, '03_chat_assistant.png') });
      console.log('3. Chat captured');
      break;
    }
  }

  // Click 'Timetable'
  for (const b of await page.$$('button, a')) {
    const t = (await b.innerText()).trim();
    if (t === 'Timetable' || t === 'Classes') {
      await b.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(outDir, '04_timetable_view.png') });
      console.log('4. Timetable captured');
      break;
    }
  }

  // Click 'Canteen'
  for (const b of await page.$$('button, a')) {
    const t = (await b.innerText()).trim();
    if (t === 'Canteen' || t === 'Food') {
      await b.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(outDir, '05_canteen_meals_view.png') });
      console.log('5. Canteen captured');
      break;
    }
  }

  // Clear storage and log in as Admin
  await page.evaluate(() => localStorage.clear());
  await page.goto('https://campusos-mvp.vercel.app', { waitUntil: 'networkidle', timeout: 35000 });
  for (const b of await page.$$('button')) {
    const t = await b.innerText();
    if (t.includes('ADMIN')) {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(500);
  for (const b of await page.$$('button')) {
    const t = await b.innerText();
    if (t.includes('Sign In')) {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(4000);

  // Find Admin Console
  for (const b of await page.$$('button, a')) {
    const t = (await b.innerText()).trim();
    if (t.includes('Admin') || t.includes('Management')) {
      await b.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(outDir, '06_admin_ingestion_console.png') });
      console.log('6. Admin Console captured');
      break;
    }
  }

  await browser.close();
  console.log('Done capturing live app screenshots!');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
