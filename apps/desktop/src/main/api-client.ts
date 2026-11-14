import type { Customer, CustomerInput, CustomerPage, Result, User } from '@erp/contracts';
import { net } from 'electron';

export function normalizeServer(value: string): string {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Use HTTPS for remote servers, or HTTP on localhost for development.');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Enter only the server origin, for example https://erp.company.local.');
  return url.origin;
}

export class ApiClient {
  private token: string | undefined;
  constructor(public server: string) { this.server = normalizeServer(server); }

  private async request<T>(path: string, method = 'GET', body?: unknown, requestId?: string): Promise<Result<T>> {
    try {
      const response = await net.fetch(`${this.server}/api/v1${path}`, {
        method, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(requestId ? { 'Idempotency-Key': requestId } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      if (response.status === 204) return { ok: true, data: null as T };
      let data: unknown;
      try { data = await response.json(); } catch { return { ok: false, error: 'The server returned an invalid response. Check the server address.', status: response.status }; }
      if (!response.ok) {
        if (response.status === 401) this.token = undefined;
        const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : 'The server rejected the request.';
        return { ok: false, error: message, status: response.status };
      }
      return { ok: true, data: data as T };
    } catch {
      return { ok: false, error: 'Cannot reach the server. Check its address, network connection, HTTPS certificate, and whether the server is running.' };
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
  async login(input: unknown): Promise<Result<User>> {
    const result = await this.request<{ token: string; user: User }>('/auth/login', 'POST', input);
    if (!result.ok) return result;
    if (!/^[a-f0-9]{64}$/.test(result.data.token) || !result.data.user?.id) return { ok: false, error: 'The server returned an invalid sign-in response.' };
    this.token = result.data.token;
    return { ok: true, data: result.data.user };
  }
  async logout(): Promise<Result<null>> {
    const result = this.token ? await this.request<null>('/auth/logout', 'POST') : { ok: true as const, data: null };
    this.token = undefined;
    return result;
  }
  listCustomers(page: number) { return this.request<CustomerPage>(`/customers?page=${page}`); }
  createCustomer(input: CustomerInput, requestId: string) { return this.request<Customer>('/customers', 'POST', input, requestId); }
}
