import { watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { build, createProcessGroup, electronEnvironment, launcherLog, require, root, terminate, waitForUrl } from './processes.mjs';

const mode = process.argv[2] || 'all';
let group;
let log;
let watcher;
let timer;
try {
  if (!['all','desktop','server'].includes(mode)) throw new Error('Use npm run dev, dev:desktop or dev:server.');
  build(mode === 'all' ? 'build' : `build:${mode}`);
  log = launcherLog();
  group = createProcessGroup(log);
  log.info('development.started', { processType: mode });
  const tsc = require.resolve('typescript/bin/tsc');
  const compiler = (name, project, extra = []) => {
    const child = group.launch(name, tsc, ['-p', project, '--watch', '--preserveWatchOutput', ...extra]);
    child.on('exit', () => { if (!group.stopped) { group.stop(); watcher?.close(); process.exitCode = 1; } });
    return child;
  };
  compiler('logging-compiler', 'packages/logging/tsconfig.json');
  compiler('contracts-compiler', 'packages/contracts/tsconfig.json');
  if (mode !== 'desktop') {
    compiler('server-compiler', 'apps/server/tsconfig.json');
    const server = group.launch('server-watch', '--watch', ['apps/server/dist/main.js']);
    server.on('exit', () => { if (!group.stopped) { group.stop(); process.exitCode = 1; } });
    const { settings } = require('../apps/server/dist/config.js');
    const config = settings();
    const host = config.host === '::1' ? '[::1]' : ['0.0.0.0','::'].includes(config.host) ? '127.0.0.1' : config.host;
    await waitForUrl(`http://${host}:${config.port}/api/v1/health`, server);
  }
  if (mode !== 'server') {
    compiler('desktop-compiler', 'apps/desktop/tsconfig.main.json');
    compiler('renderer-types', 'apps/desktop/tsconfig.json', ['--noEmit']);
    const vite = group.launch('vite', resolve(dirname(require.resolve('vite/package.json')),'bin/vite.js'), ['--configLoader','runner'], { cwd: resolve(root,'apps/desktop') });
    vite.on('exit', () => { if (!group.stopped) { group.stop(); process.exitCode = 1; } });
    await waitForUrl('http://127.0.0.1:5173', vite);
    let electron;
    let restarting = false;
    function launchElectron() {
      if (group.stopped) return;
      electron = group.launch('desktop', require.resolve('electron/cli.js'), ['apps/desktop'], { env: electronEnvironment({ ERP_DEV_RENDERER_URL: 'http://127.0.0.1:5173' }) });
      electron.on('exit', code => {
        if (restarting || group.stopped) return;
        group.stop(); watcher?.close(); process.exitCode = code || 0;
      });
    }
    launchElectron();
    watcher = watch(resolve(root,'apps/desktop/dist/main'), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (group.stopped || restarting) return;
        restarting = true;
        if (electron?.exitCode === null) { electron.once('exit', () => { restarting = false; launchElectron(); }); terminate(electron); }
        else { restarting = false; launchElectron(); }
      }, 500);
    });
    process.once('exit', () => { clearTimeout(timer); watcher?.close(); });
    console.log('Development workspace ready. Renderer changes reload through Vite; server and desktop code rebuild automatically. Press Ctrl+C to stop.');
  }
} catch (error) {
  log?.error('development.startup_failed', { errorCode: error.code });
  console.error(error.message);
  clearTimeout(timer); watcher?.close(); group?.stop(); process.exitCode = 1;
}
