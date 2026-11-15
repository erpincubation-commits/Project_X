import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, require } from './processes.mjs';

if (process.platform !== 'win32') throw new Error('Build Windows installers on Windows or through the windows-installer GitHub workflow.');
const directoryOnly = process.argv.includes('--dir');
if (process.argv.slice(2).some(value => value !== '--dir')) throw new Error('Unsupported packaging option.');
const env = { ...process.env, ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE || resolve(root,'.local/electron-builder-cache') };
delete env.ELECTRON_RUN_AS_NODE;
await mkdir(env.ELECTRON_BUILDER_CACHE, { recursive: true });
const cli = resolve(dirname(require.resolve('electron-builder/package.json')), 'cli.js');
const result = spawnSync(process.execPath, [cli,'--config','electron-builder.config.cjs','--win',directoryOnly ? 'dir' : 'nsis','--x64','--publish','never'], { cwd: resolve(root,'apps/desktop'), env, stdio: 'inherit', windowsHide: true });
if (result.error || result.status !== 0) process.exit(result.status || 1);
if (!directoryOnly) {
  const version = JSON.parse(await readFile(resolve(root,'apps/desktop/package.json'),'utf8')).version;
  const expected = `SMB-ERP-${version}-x64-setup.exe`;
  const files = await readdir(resolve(root,'release'));
  if (!files.includes(expected)) throw new Error('The Windows installer was not produced.');
  const digest = createHash('sha256').update(await readFile(resolve(root,'release',expected))).digest('hex');
  await writeFile(resolve(root,'release',`${expected}.sha256`), `${digest}  ${expected}\n`);
  console.log(`Installer and SHA-256 checksum ready in release/: ${expected}`);
}
