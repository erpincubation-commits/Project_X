import { app, BrowserWindow, ipcMain, net, protocol, session, type IpcMainInvokeEvent } from 'electron';
import { resolve, sep, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { ApiClient, normalizeServer } from './api-client';
import type { CustomerInput } from '@erp/contracts';

protocol.registerSchemesAsPrivileged([{ scheme: 'erp', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (process.env.ERP_SMOKE_PROFILE) app.setPath('userData', process.env.ERP_SMOKE_PROFILE);

function validateSender(event: IpcMainInvokeEvent) {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== 'erp://app/') throw new Error('Untrusted IPC sender.');
}

async function main() {
  await app.whenReady();
  const configFile = join(app.getPath('userData'), 'connection.json');
  let server = 'http://127.0.0.1:3001';
  try { server = normalizeServer(JSON.parse(await readFile(configFile, 'utf8')).server); } catch { /* First launch uses localhost. */ }
  const api = new ApiClient(server);
  ipcMain.handle('server:get', event => { validateSender(event); return api.server; });
  ipcMain.handle('server:connect', async (event, value: unknown) => {
    validateSender(event);
    if (typeof value !== 'string' || value.length > 2048) return { ok: false, error: 'Enter a valid server address.' };
    const result = await api.connect(value);
    if (result.ok) {
      try { await writeFile(configFile, JSON.stringify({ server: api.server })); }
      catch { return { ok: false, error: 'Connected, but the server address could not be saved. Check your profile folder permissions.' }; }
    }
    return result;
  });
  ipcMain.handle('auth:login', (event, input: unknown) => {
    validateSender(event);
    if (!input || typeof input !== 'object' || !('email' in input) || !('password' in input) || typeof input.email !== 'string' || input.email.length > 254 || typeof input.password !== 'string' || input.password.length > 128) return { ok: false, error: 'Enter your email and password.' };
    return api.login({ email: input.email, password: input.password });
  });
  ipcMain.handle('auth:logout', event => { validateSender(event); return api.logout(); });
  ipcMain.handle('customers:list', (event, page: unknown) => {
    validateSender(event);
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > 100000) return { ok: false, error: 'Invalid page number.' };
    return api.listCustomers(page);
  });
  ipcMain.handle('customers:create', (event, input: CustomerInput, requestId: unknown) => {
    validateSender(event);
    if (!input || typeof input.code !== 'string' || input.code.length > 32 || typeof input.name !== 'string' || input.name.length > 160 || typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, error: 'Enter valid customer details.' };
    return api.createCustomer({ code: input.code, name: input.name }, requestId);
  });

  const root = resolve(__dirname, '../renderer');
  protocol.handle('erp', request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', { status: 404 });
    let pathname: string;
    try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad request', { status: 400 }); }
    const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(target).toString());
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
    window.loadURL('erp://app/').catch(() => { console.error('Desktop assets could not be loaded. Run npm run build:desktop.'); app.exit(1); });
    window.webContents.on('did-fail-load', () => console.error('The desktop window failed to load. Rebuild the desktop assets.'));
    window.webContents.on('render-process-gone', () => console.error('The renderer stopped unexpectedly. Restart the application.'));
  }
  openWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openWindow(); });
}
main().catch(() => { console.error('Desktop startup failed. Check installation and profile folder permissions.'); app.exit(1); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
