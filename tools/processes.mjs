import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const require = createRequire(import.meta.url);
export function terminate(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  // Windows does not propagate SIGTERM from the Node wrapper to Electron/watch children.
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    if (result.status !== 0) child.kill('SIGTERM');
  } else child.kill('SIGTERM');
}
export function build(script = 'build') {
  if (!['build','build:server','build:desktop'].includes(script)) throw new Error('Unsupported build command.');
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d','/s','/c',`npm run ${script}`], { cwd: root, stdio: 'inherit', windowsHide: true })
    : spawnSync('npm', ['run', script], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Build failed. Resolve the compiler output above, then retry.');
}
export function createProcessGroup(log) {
  const children = new Set();
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    for (const child of children) terminate(child);
  }
  process.once('SIGINT', () => { stop(); process.exit(130); });
  process.once('SIGTERM', () => { stop(); process.exit(143); });
  process.once('exit', stop);
  function launch(name, script, args = [], options = {}) {
    const child = spawn(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit', windowsHide: true, ...options });
    children.add(child);
    child.on('error', error => { log.error('launcher.spawn_failed', { processType: name, errorCode: error.code }); stop(); process.exitCode = 1; });
    child.on('exit', (exitCode, signal) => { children.delete(child); log.info('launcher.child_exited', { processType: name, exitCode, signal }); });
    return child;
  }
  return { launch, stop, get stopped() { return stopped; } };
}
export function launcherLog() {
  return require('@erp/logging').createLogger({ component: 'launcher', directory: resolve(root, '.local/logs/launcher') });
}
export async function waitForUrl(url, child, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(800) }); if (response.ok) return; } catch { /* Startup may still be in progress. */ }
    if (child && (child.exitCode !== null || child.signalCode !== null)) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('A required service did not become ready. Check its port, PostgreSQL connection and diagnostic logs.');
}
export function electronEnvironment(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}
