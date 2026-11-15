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
  createCustomer: (input, requestId) => ipcRenderer.invoke('customers:create', input, requestId),
  listSuppliers: query => ipcRenderer.invoke('procurement:suppliers',query),
  createSupplier: (input,key) => ipcRenderer.invoke('procurement:supplier-create',input,key),
  updateSupplier: (id,input,key) => ipcRenderer.invoke('procurement:supplier-update',id,input,key),
  listItems: query => ipcRenderer.invoke('procurement:items',query),
  createItem: (input,key) => ipcRenderer.invoke('procurement:item-create',input,key),
  updateItem: (id,input,key) => ipcRenderer.invoke('procurement:item-update',id,input,key),
  listPurchaseRequests: query => ipcRenderer.invoke('procurement:requests',query),
  getPurchaseRequest: id => ipcRenderer.invoke('procurement:request',id),
  createPurchaseRequest: (input,key) => ipcRenderer.invoke('procurement:request-create',input,key),
  updatePurchaseRequest: (id,input,key) => ipcRenderer.invoke('procurement:request-update',id,input,key),
  submitPurchaseRequest: (id,input,key) => ipcRenderer.invoke('procurement:request-submit',id,input,key),
  decidePurchaseRequest: (id,input,key) => ipcRenderer.invoke('procurement:request-decide',id,input,key),
  listApprovers: () => ipcRenderer.invoke('procurement:approvers'),
  recordHistory: (kind,id) => ipcRenderer.invoke('procurement:history',kind,id)
};
contextBridge.exposeInMainWorld('erp', api);
