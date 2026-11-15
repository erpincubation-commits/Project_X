import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI } from '@erp/contracts';

const api: DesktopAPI = {
  openLogs: () => ipcRenderer.invoke('diagnostics:open'),
  reportError: kind => ipcRenderer.invoke('diagnostics:report', kind),
  getServer: () => ipcRenderer.invoke('server:get'),
  connect: url => ipcRenderer.invoke('server:connect', url),
  login: input => ipcRenderer.invoke('auth:login', input),
  setupStatus: () => ipcRenderer.invoke('auth:setup-status'),
  setup: input => ipcRenderer.invoke('auth:setup', input),
  verifyMfa: input => ipcRenderer.invoke('auth:verify-mfa', input),
  me: () => ipcRenderer.invoke('auth:me'),
  revokeSessions: () => ipcRenderer.invoke('auth:revoke-sessions'),
  listUsers: () => ipcRenderer.invoke('access:users'),
  createUser: input => ipcRenderer.invoke('access:create-user', input),
  updateUser: (id, input) => ipcRenderer.invoke('access:update-user', id, input),
  listAudit: page => ipcRenderer.invoke('access:audit', page),
  logout: () => ipcRenderer.invoke('auth:logout'),
  listCustomers: page => ipcRenderer.invoke('customers:list', page),
  createCustomer: (input, requestId) => ipcRenderer.invoke('customers:create', input, requestId)
};
contextBridge.exposeInMainWorld('erp', api);
