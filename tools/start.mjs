import { build, createProcessGroup, electronEnvironment, launcherLog, require, waitForUrl } from './processes.mjs';

let group;
let log;
try {
  build();
  log = launcherLog();
  group = createProcessGroup(log);
  const { settings } = require('../apps/server/dist/config.js');
  const { port, host } = settings();
  const hostname = host === '::1' ? '[::1]' : ['0.0.0.0','::'].includes(host) ? '127.0.0.1' : host;
  const health = `http://${hostname}:${port}/api/v1/health`;
  let existing;
  try { existing = await fetch(health, { signal: AbortSignal.timeout(1000) }); } catch { /* No existing server. */ }
  if (existing) {
    if (!existing.ok || (await existing.json()).status !== 'ready') throw new Error('A server is already using the API port but is not ready. Check its PostgreSQL configuration or stop it before retrying.');
    log.info('launcher.reusing_server');
  } else {
    const server = group.launch('server','apps/server/dist/main.js');
    await waitForUrl(health, server);
    server.on('exit', () => {
      if (!group.stopped) {
        log.error('launcher.server_stopped');
        console.error('The ERP server stopped. Check .local/logs/server and restart the application.');
      }
    });
  }
  const desktop = group.launch('desktop',require.resolve('electron/cli.js'),['apps/desktop'],{env:electronEnvironment()});
  desktop.on('exit', code => { group.stop(); process.exitCode = code || 0; });
  log.info('launcher.ready');
} catch (error) {
  log?.error('launcher.startup_failed', { errorCode: error.code });
  console.error(error.message);
  console.error('Check .local/logs/launcher and .local/logs/server for diagnostics.');
  group?.stop(); process.exitCode = 1;
}
