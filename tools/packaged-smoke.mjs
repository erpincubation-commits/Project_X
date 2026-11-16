import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { root, electronEnvironment } from './processes.mjs';

await mkdir(resolve(root,'.local'), { recursive: true });
const profile = await mkdtemp(resolve(root,'.local/packaged-smoke-'));
const executablePath = resolve(root,'release/win-unpacked/SMB ERP.exe');
let application;
try {
  application = await _electron.launch({ executablePath, env: electronEnvironment({ ERP_SMOKE_PROFILE: profile }), timeout: 30000 });
  const page = await application.firstWindow();
  await page.getByRole('heading', { name: 'Connect to your workspace' }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.erp.connect), 'function');
  assert.equal(await page.evaluate(() => typeof window.erp.previewImport), 'function');
  assert.equal(await page.evaluate(() => typeof window.erp.listPrivacyCases), 'function');
  assert.equal(await application.evaluate(({ app }) => app.isPackaged), true);
  console.log('PASS: packaged desktop starts with bundled assets, an isolated preload and a sandboxed renderer.');
} finally { if (application) await application.close(); }
