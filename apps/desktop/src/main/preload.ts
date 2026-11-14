import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI } from '@erp/contracts';

const api: DesktopAPI = {
  getServer: () => ipcRenderer.invoke('server:get'),
  connect: url => ipcRenderer.invoke('server:connect', url),
  login: input => ipcRenderer.invoke('auth:login', input),
  logout: () => ipcRenderer.invoke('auth:logout'),
  listCustomers: page => ipcRenderer.invoke('customers:list', page),
  createCustomer: (input, requestId) => ipcRenderer.invoke('customers:create', input, requestId)
};
contextBridge.exposeInMainWorld('erp', api);
