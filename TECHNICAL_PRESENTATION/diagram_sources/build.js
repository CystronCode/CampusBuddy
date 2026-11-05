// Build script: generates every SVG and renders a 2x PNG for each.
// Usage (from repo root):  node TECHNICAL_PRESENTATION/diagram_sources/build.js [filter]
// Rendering re-uses the Playwright package already present in frontend-next/node_modules
// and the locally installed Google Chrome (no new dependencies are installed).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = [];
const reg = (rel, fn) => OUT.push({ rel, fn });

const A = require('./d_arch');
reg('01_SYSTEM_ARCHITECTURE/high_level_architecture', A.highLevel);
reg('01_SYSTEM_ARCHITECTURE/technology_stack', A.techStack);
reg('01_SYSTEM_ARCHITECTURE/component_architecture', A.component);
for (const m of ['d_flow', 'd_dbsec', 'd_product', 'd_status']) {
  if (fs.existsSync(path.join(__dirname, m + '.js'))) require('./' + m).register(reg);
}

(async () => {
  const filter = process.argv[2];
  const { chromium } = require(path.resolve(ROOT, '..', 'frontend-next', 'node_modules', 'playwright'));
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1000, height: 800 } });
  for (const { rel, fn } of OUT) {
    if (filter && !rel.includes(filter)) continue;
    const svg = fn();
    const file = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.svg', svg);
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    const el = await page.$('svg');
    await el.screenshot({ path: file + '.png' });
    console.log('OK', rel);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
