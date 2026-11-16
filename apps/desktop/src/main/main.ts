import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell, type IpcMainInvokeEvent } from 'electron';
import { resolve, sep, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { ApiClient, normalizeServer } from './api-client';
import { registerProcurementIPC } from './procurement-ipc';
import { registerBooksIPC } from './books-ipc';
import { registerOperationsIPC } from './operations-ipc';
import { registerTradeIPC } from './trade-ipc';
import { createUserInput, updateUserInput, loginInput, setupInput, type CustomerInput } from '@erp/contracts';
import { createLogger, diagnosticError } from '@erp/logging';

protocol.registerSchemesAsPrivileged([{ scheme: 'erp', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (process.env.ERP_SMOKE_PROFILE) app.setPath('userData', process.env.ERP_SMOKE_PROFILE);
app.setName('SMB ERP');
const logDirectory = join(app.getPath('userData'), 'logs');
const log = createLogger({ component: 'desktop', directory: logDirectory, console: !app.isPackaged });
let quitting = false;
let fatalReported = false;
const devRenderer = !app.isPackaged && process.env.ERP_DEV_RENDERER_URL === 'http://127.0.0.1:5173' ? 'http://127.0.0.1:5173/' : undefined;
const rendererUrl = devRenderer || 'erp://app/';

function fatal(event: string, error: unknown) {
  if (fatalReported) return;
  fatalReported = true;
  quitting = true;
  log.error(event, diagnosticError(error));
  if (!process.env.ERP_SMOKE_PROFILE) dialog.showErrorBox('SMB ERP could not continue', `Restart the application. If the problem continues, share the diagnostic log with your administrator.\n\nLogs: ${logDirectory}`);
  app.exit(1);
}
process.on('uncaughtException', error => fatal('process.uncaught_exception', error));
process.on('unhandledRejection', error => fatal('process.unhandled_rejection', error));
app.on('before-quit', () => { quitting = true; log.info('application.stopping'); });
app.on('child-process-gone', (_event, details) => log.error('process.child_gone', { processType: details.type, reason: details.reason, exitCode: details.exitCode }));

function handle(channel: string, action: (...args: any[]) => unknown) {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try { validateSender(event); return await action(...args); }
    catch (error) {
      log.error('ipc.failed', { channel, ...diagnosticError(error) });
      if (channel === 'server:get') throw new Error('Could not read the saved connection. Restart the application.');
      return { ok: false, error: 'The desktop could not complete this action. Open diagnostic logs or restart the application.' };
    }
  });
}

function validateSender(event: IpcMainInvokeEvent) {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== rendererUrl) throw new Error('Untrusted IPC sender.');
}

async function main() {
  await app.whenReady();
  log.info('application.started', { version: app.getVersion() });
  const configFile = join(app.getPath('userData'), 'connection.json');
  let server = 'http://127.0.0.1:3001';
  try { server = normalizeServer(JSON.parse(await readFile(configFile, 'utf8')).server); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') log.warn('connection.config_invalid', diagnosticError(error)); }
  const api = new ApiClient(server);
  registerProcurementIPC(handle,api);
  registerBooksIPC(handle,api);
  registerTradeIPC(handle,api);
  registerOperationsIPC(handle,api);
  handle('server:get', () => api.server);
  handle('server:connect', async (value: unknown) => {
    if (typeof value !== 'string' || value.length > 2048) return { ok: false, error: 'Enter a valid server address.' };
    const result = await api.connect(value);
    if (result.ok) {
      try { await writeFile(configFile, JSON.stringify({ server: api.server })); }
      catch (error) { log.error('connection.config_write_failed', diagnosticError(error)); return { ok: false, error: 'Connected, but the server address could not be saved. Check your profile folder permissions.' }; }
    }
    return result;
  });
  handle('auth:login', (input: unknown) => {
    const parsed = loginInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Enter your email and password.' };
    return api.login(parsed.data);
  });
  handle('auth:setup-status', () => api.setupStatus());
  handle('auth:setup', (input: unknown) => { const parsed = setupInput.safeParse(input); return parsed.success ? api.setup(parsed.data) : { ok: false, error: 'Enter a valid email, setup code and a password of at least 12 characters (at most 72 UTF-8 bytes).' }; });
  handle('auth:verify-mfa', (input: unknown) => {
    if (!input || typeof input !== 'object' || !('code' in input) || typeof input.code !== 'string' || input.code.length < 6 || input.code.length > 40) return { ok: false, error: 'Enter an authenticator or recovery code.' };
    return api.verifyMfa({ code: input.code.trim() });
  });
  handle('auth:me', () => api.me());
  handle('auth:revoke-sessions', () => api.revokeSessions());
  handle('access:users', () => api.listUsers());
  handle('access:create-user', (input: unknown) => { const parsed = createUserInput.safeParse(input); return parsed.success ? api.createUser(parsed.data) : { ok: false, error: 'Enter a valid email, role and a password of at least 12 characters (at most 72 UTF-8 bytes).' }; });
  handle('access:update-user', (id: unknown, input: unknown) => {
    const parsed = updateUserInput.safeParse(input);
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || !parsed.success) return { ok: false, error: 'Enter valid account details.' };
    return api.updateUser(id, parsed.data);
  });
  handle('access:audit', (page: unknown) => typeof page === 'number' && Number.isInteger(page) && page > 0 && page <= 100000 ? api.listAudit(page) : { ok: false, error: 'Invalid page number.' });
  handle('auth:logout', () => api.logout());
  handle('customers:list', (page: unknown) => {
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > 100000) return { ok: false, error: 'Invalid page number.' };
    return api.listCustomers(page);
  });
  handle('customers:create', (input: CustomerInput, requestId: unknown) => {
    if (!input || typeof input.code !== 'string' || input.code.length > 32 || typeof input.name !== 'string' || input.name.length > 160 || typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, error: 'Enter valid customer details.' };
    return api.createCustomer({ code: input.code, name: input.name }, requestId);
  });
  handle('diagnostics:open', async () => {
    const error = await shell.openPath(logDirectory);
    if (error) { log.warn('logs.open_failed'); return { ok: false, error: 'The log folder could not be opened. Contact your administrator.' }; }
    return { ok: true, data: null };
  });
  let reportWindow = Date.now();
  let reports = 0;
  handle('diagnostics:report', (kind: unknown) => {
    if (Date.now() - reportWindow > 60000) { reportWindow = Date.now(); reports = 0; }
    if (['render','script','promise','action'].includes(String(kind)) && reports++ < 10) log.error('renderer.error', { reason: String(kind) });
  });

  const root = resolve(__dirname, '../renderer');
  protocol.handle('erp', async request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', { status: 404 });
    let pathname: string;
    try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad request', { status: 400 }); }
    const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + sep)) return new Response('Not found', { status: 404 });
    try { return await net.fetch(pathToFileURL(target).toString()); }
    catch (error) { log.error('assets.read_failed', diagnosticError(error)); return new Response('Application asset unavailable', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  function openWindow() {
    const window = new BrowserWindow({
      width: 1300, height: 850, minWidth: 900, minHeight: 650, title: 'SMB ERP', backgroundColor: '#f5f7f5',
      show: !process.env.ERP_SMOKE_PROFILE,
      webPreferences: { preload: join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    window.removeMenu();
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('preload-error', (_event, _path, error) => fatal('renderer.preload_failed', error));
    window.webContents.on('did-fail-load', (_event, errorCode) => { if (errorCode !== -3) log.error('renderer.load_failed', { errorCode }); });
    window.webContents.on('render-process-gone', (_event, details) => {
      if (quitting || window.isDestroyed()) return;
      log.error('renderer.process_gone', { reason: details.reason, exitCode: details.exitCode });
      if (!process.env.ERP_SMOKE_PROFILE) void dialog.showMessageBox(window, { type: 'error', title: 'Workspace stopped', message: 'The workspace stopped unexpectedly.', detail: 'Reload to reconnect. Unsaved form entries may need to be entered again.', buttons: ['Reload workspace', 'Close application'], defaultId: 0, cancelId: 1 }).then(result => { if (result.response === 0 && !window.isDestroyed()) window.reload(); else app.quit(); }).catch(error => fatal('renderer.recovery_failed', error));
    });
    window.on('unresponsive', () => log.warn('renderer.unresponsive'));
    window.loadURL(rendererUrl).catch(error => fatal('renderer.startup_failed', error));
  }
  openWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openWindow(); });
}
main().catch(error => fatal('application.startup_failed', error));
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
