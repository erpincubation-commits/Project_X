import type { Customer, CustomerInput, CustomerPage, Result, User, AuthChallenge, MfaPrompt, SessionResult, SignedIn, SetupStatus, ManagedUser, AuditEvent, Role } from '@erp/contracts';
import { net } from 'electron';
import { randomUUID } from 'node:crypto';
import { diagnosticError } from '@erp/logging';
import { desktopLog } from './logger';
import type { Page, Supplier, Item, SupplierInput, ItemInput, SupplierUpdateInput, ItemUpdateInput, ProcurementQuery, PurchaseRequest, PurchaseRequestInput, PurchaseRequestUpdateInput, SubmitRequestInput, DecideRequestInput, RecordHistory, Approver } from '@erp/contracts';

export function normalizeServer(value: string): string {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Use HTTPS for remote servers, or HTTP on localhost for development.');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Enter only the server origin, for example https://erp.company.local.');
  return url.origin;
}

export class ApiClient {
  private token: string | undefined;
  private challenge: string | undefined;
  constructor(public server: string) { this.server = normalizeServer(server); }

  private async request<T>(path: string, method = 'GET', body?: unknown, requestId?: string): Promise<Result<T>> {
    const correlationId = randomUUID();
    const started = performance.now();
    const route = path.split('?')[0];
    try {
      const response = await net.fetch(`${this.server}/api/v1${path}`, {
        method, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': correlationId, ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(requestId ? { 'Idempotency-Key': requestId } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const fields = { requestId: correlationId, route, method, status: response.status, durationMs: Math.round(performance.now() - started) };
      (response.ok ? desktopLog.info : desktopLog.warn)('api.response', fields);
      if (response.status === 204) return { ok: true, data: null as T };
      let data: unknown;
      try { data = await response.json(); } catch { desktopLog.warn('api.invalid_response', fields); return { ok: false, error: `The server returned an invalid response. Check the server address. Reference: ${correlationId}`, status: response.status }; }
      if (!response.ok) {
        if (response.status === 401) this.token = undefined;
        const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : 'The server rejected the request.';
        return { ok: false, error: `${message} Reference: ${correlationId}`, status: response.status };
      }
      return { ok: true, data: data as T };
    } catch (error) {
      desktopLog.error('api.connection_failed', { requestId: correlationId, method, route, durationMs: Math.round(performance.now() - started), ...diagnosticError(error) });
      return { ok: false, error: `Cannot reach the server. Check its address, network connection, HTTPS certificate, and whether the server is running. Reference: ${correlationId}` };
    }
  }

  async connect(value: string): Promise<Result<{ status: string }>> {
    try {
      const candidate = new ApiClient(normalizeServer(value));
      const result = await candidate.request<{ status: string }>('/health');
      if (!result.ok) return result;
      if (result.data.status !== 'ready') return { ok: false, error: 'The server is not ready. Ask the administrator to check PostgreSQL.' };
      await this.logout();
      this.server = candidate.server;
      return result;
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Invalid server address.' }; }
  }
  setupStatus() { return this.request<SetupStatus>('/auth/setup-status'); }
  private async beginAuth(path: string, input: unknown): Promise<Result<MfaPrompt>> {
    this.token = undefined; this.challenge = undefined;
    const result = await this.request<AuthChallenge>(path, 'POST', input);
    if (!result.ok) return result;
    if (!/^[a-f0-9]{64}$/.test(result.data.challenge) || !result.data.mfaRequired) return { ok: false, error: 'The server returned an invalid sign-in response.' };
    this.challenge = result.data.challenge;
    return { ok: true, data: { mfaRequired: true, ...(result.data.enrollment ? { enrollment: result.data.enrollment } : {}) } };
  }
  login(input: unknown) { return this.beginAuth('/auth/login', input); }
  setup(input: unknown) { return this.beginAuth('/auth/setup', input); }
  async verifyMfa(input: { code: string }): Promise<Result<SignedIn>> {
    if (!this.challenge) return { ok: false, error: 'Sign in again to request a verification challenge.' };
    const result = await this.request<SessionResult>('/auth/mfa/verify', 'POST', { challenge: this.challenge, code: input.code });
    if (!result.ok) return result;
    if (!/^[a-f0-9]{64}$/.test(result.data.token) || !result.data.user?.id || !Array.isArray(result.data.user.permissions)) return { ok: false, error: 'The server returned an invalid session response.' };
    this.token = result.data.token;
    this.challenge = undefined;
    return { ok: true, data: { user: result.data.user, recoveryCodes: result.data.recoveryCodes } };
  }
  me() { return this.request<User>('/auth/me'); }
  async revokeSessions() { const result = await this.request<null>('/auth/revoke-sessions', 'POST'); if (result.ok) this.token = undefined; return result; }
  listUsers() { return this.request<ManagedUser[]>('/access/users'); }
  createUser(input: { email: string; password: string; role: Role }) { return this.request<ManagedUser>('/access/users', 'POST', input); }
  updateUser(id: string, input: { role: Role; active: boolean }) { return this.request<ManagedUser>(`/access/users/${id}`, 'PATCH', input); }
  listAudit(page: number) { return this.request<{ items: AuditEvent[]; page: number }>(`/access/audit?page=${page}`); }
  async logout(): Promise<Result<null>> {
    const result = this.token ? await this.request<null>('/auth/logout', 'POST') : { ok: true as const, data: null };
    this.token = undefined;
    this.challenge = undefined;
    return result;
  }
  listCustomers(page: number) { return this.request<CustomerPage>(`/customers?page=${page}`); }
  createCustomer(input: CustomerInput, requestId: string) { return this.request<Customer>('/customers', 'POST', input, requestId); }
  private query(query: Partial<ProcurementQuery>) { return new URLSearchParams(Object.entries(query).map(([key,value])=>[key,String(value)])).toString(); }
  listSuppliers(query: Partial<ProcurementQuery>) { return this.request<Page<Supplier>>(`/procurement/suppliers?${this.query(query)}`); }
  createSupplier(input: SupplierInput,key: string) { return this.request<Supplier>('/procurement/suppliers','POST',input,key); }
  updateSupplier(id: string,input: SupplierUpdateInput,key: string) { return this.request<Supplier>(`/procurement/suppliers/${id}`,'PATCH',input,key); }
  listItems(query: Partial<ProcurementQuery>) { return this.request<Page<Item>>(`/procurement/items?${this.query(query)}`); }
  createItem(input: ItemInput,key: string) { return this.request<Item>('/procurement/items','POST',input,key); }
  updateItem(id: string,input: ItemUpdateInput,key: string) { return this.request<Item>(`/procurement/items/${id}`,'PATCH',input,key); }
  listPurchaseRequests(query: Partial<ProcurementQuery>) { return this.request<Page<PurchaseRequest>>(`/procurement/requests?${this.query(query)}`); }
  getPurchaseRequest(id: string) { return this.request<PurchaseRequest>(`/procurement/requests/${id}`); }
  createPurchaseRequest(input: PurchaseRequestInput,key: string) { return this.request<PurchaseRequest>('/procurement/requests','POST',input,key); }
  updatePurchaseRequest(id: string,input: PurchaseRequestUpdateInput,key: string) { return this.request<PurchaseRequest>(`/procurement/requests/${id}`,'PATCH',input,key); }
  submitPurchaseRequest(id: string,input: SubmitRequestInput,key: string) { return this.request<PurchaseRequest>(`/procurement/requests/${id}/submit`,'POST',input,key); }
  decidePurchaseRequest(id: string,input: DecideRequestInput,key: string) { return this.request<PurchaseRequest>(`/procurement/requests/${id}/decide`,'POST',input,key); }
  listApprovers() { return this.request<Approver[]>('/procurement/approvers'); }
  recordHistory(kind: 'supplier' | 'item' | 'purchase_request',id: string) { return this.request<RecordHistory[]>(`/procurement/history/${kind}/${id}`); }
}
