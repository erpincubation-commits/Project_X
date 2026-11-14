import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const build = process.platform === 'win32'
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], { cwd: root, stdio: 'inherit', windowsHide: true })
  : spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);

let server;
let desktop;
function stop() {
  if (desktop && desktop.exitCode === null) desktop.kill();
  if (server && server.exitCode === null) server.kill();
}
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
process.on('exit', stop);
async function main() {
  const { settings } = require('../apps/server/dist/config.js');
  const { port, host } = settings();
  const origin = `http://${['0.0.0.0', '::', '::1'].includes(host) ? '127.0.0.1' : host}:${port}`;
  async function ready() {
    try { const result = await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(1000) }); return result.ok && (await result.json()).status === 'ready'; }
    catch { return false; }
  }
  if (!await ready()) {
    server = spawn(process.execPath, ['apps/server/dist/main.js'], { cwd: root, stdio: 'inherit', windowsHide: true });
    let connected = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await ready()) { connected = true; break; }
      if (server.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!connected) throw new Error('The application server did not start. Run npm run db:start and npm run db:check, then retry.');
  } else console.log('Using the server that is already running.');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = spawn(process.execPath, [require.resolve('electron/cli.js'), 'apps/desktop'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  desktop.on('error', () => { console.error('Electron could not start. Reinstall dependencies with npm ci.'); stop(); process.exitCode = 1; });
  desktop.on('exit', code => { stop(); process.exitCode = code || 0; });
}
main().catch(error => { console.error(error.message); stop(); process.exitCode = 1; });
