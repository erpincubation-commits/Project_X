import type { Customer, CustomerInput, CustomerPage, Result, User, AuthChallenge, MfaPrompt, SessionResult, SignedIn, SetupStatus, ManagedUser, AuditEvent, Role } from '@erp/contracts';
import { net } from 'electron';
import type * as C from '@erp/contracts';
import { randomUUID } from 'node:crypto';
import { diagnosticError } from '@erp/logging';
import { desktopLog } from './logger';
import type { Page, Supplier, Item, SupplierInput, ItemInput, SupplierUpdateInput, ItemUpdateInput, ProcurementQuery, PurchaseRequest, PurchaseRequestInput, PurchaseRequestUpdateInput, SubmitRequestInput, DecideRequestInput, RecordHistory, Approver } from '@erp/contracts';
import type { BooksAPI, BooksOverview, Account, Period, Warehouse, Journal, StockMovement, StockReconciliation, TrialBalance, BankReconciliation } from '@erp/contracts';

export function normalizeServer(value: string): string {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Use HTTPS for remote servers, or HTTP on localhost for development.');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Enter only the server origin, for example https://erp.company.local.');
  return url.origin;
}

export class ApiClient implements BooksAPI {
  listOrderReceipts(id:string){return this.request<C.GoodsReceipt[]>(`/trade/orders/${id}/receipts`);}
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
  recoveryCases() { return this.request<C.RecoveryCase[]>('/identity-recovery/cases'); }
  requestRecovery(input: {email:string;verified:true}) { return this.request<{id:string}>('/identity-recovery/cases','POST',input); }
  approveRecovery(id:string) { return this.request<{token:string;expiresInSeconds:number}>(`/identity-recovery/cases/${id}/approve`,'POST',{verified:true}); }
  cancelRecovery(id:string) { return this.request<null>(`/identity-recovery/cases/${id}/cancel`,'POST'); }
  redeemRecovery(input:{token:string;newPassword:string}) { return this.request<null>('/identity-recovery/redeem','POST',input); }
  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<Result<null>> {
    const result = await this.request<null>('/auth/change-password', 'POST', input);
    if (result.ok || !result.status || result.status >= 500) {
      this.token = undefined; this.challenge = undefined;
      if (!result.ok) return { ok: false, status: 401, error: 'The result is unknown. Sign in with the new password; if it does not work, try the previous password. MFA is required.' };
    }
    return result;
  }
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
  booksOverview() {return this.request<BooksOverview>('/books');}
  setupBooks(...[input,key]:Parameters<BooksAPI['setupBooks']>){return this.request<BooksOverview>('/books/setup','POST',input,key);}
  createAccount(...[input,key]:Parameters<BooksAPI['createAccount']>){return this.request<Account>('/books/accounts','POST',input,key);}
  updateAccount(...[id,input,key]:Parameters<BooksAPI['updateAccount']>){return this.request<Account>(`/books/accounts/${id}`,'PATCH',input,key);}
  createPeriod(...[input,key]:Parameters<BooksAPI['createPeriod']>){return this.request<Period>('/books/periods','POST',input,key);}
  setPeriodState(...[id,input,key]:Parameters<BooksAPI['setPeriodState']>){return this.request<Period>(`/books/periods/${id}/state`,'POST',input,key);}
  listJournals(page:number){return this.request<Page<Journal>>(`/books/journals?page=${page}`);}
  getJournal(id:string){return this.request<Journal>(`/books/journals/${id}`);}
  createJournal(...[input,key]:Parameters<BooksAPI['createJournal']>){return this.request<Journal>('/books/journals','POST',input,key);}
  updateJournal(...[id,input,key]:Parameters<BooksAPI['updateJournal']>){return this.request<Journal>(`/books/journals/${id}`,'PATCH',input,key);}
  postJournal(...[id,input,key]:Parameters<BooksAPI['postJournal']>){return this.request<Journal>(`/books/journals/${id}/post`,'POST',input,key);}
  reverseJournal(...[id,input,key]:Parameters<BooksAPI['reverseJournal']>){return this.request<Journal>(`/books/journals/${id}/reverse`,'POST',input,key);}
  createWarehouse(...[input,key]:Parameters<BooksAPI['createWarehouse']>){return this.request<Warehouse>('/books/warehouses','POST',input,key);}
  updateWarehouse(...[id,input,key]:Parameters<BooksAPI['updateWarehouse']>){return this.request<Warehouse>(`/books/warehouses/${id}`,'PATCH',input,key);}
  listStockMovements(page:number){return this.request<Page<StockMovement>>(`/books/movements?page=${page}`);}
  postStockMovement(...[input,key]:Parameters<BooksAPI['postStockMovement']>){return this.request<StockMovement>('/books/movements','POST',input,key);}
  stockReconciliation(date:string){return this.request<StockReconciliation>(`/books/valuation?date=${date}`);}
  trialBalance(date:string){return this.request<TrialBalance>(`/books/trial-balance?date=${date}`);}
  listBankReconciliations(page:number){return this.request<Page<BankReconciliation>>(`/books/bank-reconciliations?page=${page}`);}
  getBankReconciliation(id:string){return this.request<BankReconciliation>(`/books/bank-reconciliations/${id}`);}
  createBankReconciliation(...[input,key]:Parameters<BooksAPI['createBankReconciliation']>){return this.request<BankReconciliation>('/books/bank-reconciliations','POST',input,key);}
  updateBankReconciliation(...[id,input,key]:Parameters<BooksAPI['updateBankReconciliation']>){return this.request<BankReconciliation>(`/books/bank-reconciliations/${id}`,'PATCH',input,key);}
  matchBankLine(...[id,input,key]:Parameters<BooksAPI['matchBankLine']>){return this.request<BankReconciliation>(`/books/bank-reconciliations/${id}/match`,'POST',input,key);}
  finaliseBankReconciliation(...[id,input,key]:Parameters<BooksAPI['finaliseBankReconciliation']>){return this.request<BankReconciliation>(`/books/bank-reconciliations/${id}/finalise`,'POST',input,key);}
  booksHistory(...[kind,id]:Parameters<BooksAPI['booksHistory']>){return this.request<RecordHistory[]>(`/books/history/${kind}/${id}`);}
  listTaxCodes(...[]:Parameters<C.TradeAPI['listTaxCodes']>){return this.request<C.TaxCode[]>(`/trade/taxes`);}
  createTaxCode(...[input,key]:Parameters<C.TradeAPI['createTaxCode']>){return this.request<C.TaxCode>(`/trade/taxes`, 'POST',input,key);}
  updateTaxCode(...[id,input,key]:Parameters<C.TradeAPI['updateTaxCode']>){return this.request<C.TaxCode>(`/trade/taxes/${id}`, 'PATCH',input,key);}
  listOrders(...[page]:Parameters<C.TradeAPI['listOrders']>){return this.request<C.Page<C.PurchaseOrder>>(`/trade/orders?page=${page}`);}
  getOrder(...[id]:Parameters<C.TradeAPI['getOrder']>){return this.request<C.PurchaseOrder>(`/trade/orders/${id}`);}
  createOrder(...[input,key]:Parameters<C.TradeAPI['createOrder']>){return this.request<C.PurchaseOrder>(`/trade/orders`, 'POST',input,key);}
  cancelOrder(...[id,input,key]:Parameters<C.TradeAPI['cancelOrder']>){return this.request<C.PurchaseOrder>(`/trade/orders/${id}/cancel`, 'POST',input,key);}
  listReceipts(...[page]:Parameters<C.TradeAPI['listReceipts']>){return this.request<C.Page<C.GoodsReceipt>>(`/trade/receipts?page=${page}`);}
  getReceipt(...[id]:Parameters<C.TradeAPI['getReceipt']>){return this.request<C.GoodsReceipt>(`/trade/receipts/${id}`);}
  createReceipt(...[input,key]:Parameters<C.TradeAPI['createReceipt']>){return this.request<C.GoodsReceipt>(`/trade/receipts`, 'POST',input,key);}
  listSupplierInvoices(...[page]:Parameters<C.TradeAPI['listSupplierInvoices']>){return this.request<C.Page<C.TradeInvoice>>(`/trade/supplier-invoices?page=${page}`);}
  getSupplierInvoice(...[id]:Parameters<C.TradeAPI['getSupplierInvoice']>){return this.request<C.TradeInvoice>(`/trade/supplier-invoices/${id}`);}
  createSupplierInvoice(...[input,key]:Parameters<C.TradeAPI['createSupplierInvoice']>){return this.request<C.TradeInvoice>(`/trade/supplier-invoices`, 'POST',input,key);}
  updateSupplierInvoice(...[id,input,key]:Parameters<C.TradeAPI['updateSupplierInvoice']>){return this.request<C.TradeInvoice>(`/trade/supplier-invoices/${id}`, 'PATCH',input,key);}
  matchSupplierInvoice(...[id,input,key]:Parameters<C.TradeAPI['matchSupplierInvoice']>){return this.request<C.TradeInvoice>(`/trade/supplier-invoices/${id}/match`, 'POST',input,key);}
  resolveSupplierInvoice(...[id,input,key]:Parameters<C.TradeAPI['resolveSupplierInvoice']>){return this.request<C.TradeInvoice>(`/trade/supplier-invoices/${id}/resolve`, 'POST',input,key);}
  postSupplierInvoice(...[id,input,key]:Parameters<C.TradeAPI['postSupplierInvoice']>){return this.request<C.TradeInvoice>(`/trade/supplier-invoices/${id}/post`, 'POST',input,key);}
  listCustomerInvoices(...[page]:Parameters<C.TradeAPI['listCustomerInvoices']>){return this.request<C.Page<C.TradeInvoice>>(`/trade/customer-invoices?page=${page}`);}
  getCustomerInvoice(...[id]:Parameters<C.TradeAPI['getCustomerInvoice']>){return this.request<C.TradeInvoice>(`/trade/customer-invoices/${id}`);}
  createCustomerInvoice(...[input,key]:Parameters<C.TradeAPI['createCustomerInvoice']>){return this.request<C.TradeInvoice>(`/trade/customer-invoices`, 'POST',input,key);}
  updateCustomerInvoice(...[id,input,key]:Parameters<C.TradeAPI['updateCustomerInvoice']>){return this.request<C.TradeInvoice>(`/trade/customer-invoices/${id}`, 'PATCH',input,key);}
  postCustomerInvoice(...[id,input,key]:Parameters<C.TradeAPI['postCustomerInvoice']>){return this.request<C.TradeInvoice>(`/trade/customer-invoices/${id}/post`, 'POST',input,key);}
  voidInvoice(...[id,input,key]:Parameters<C.TradeAPI['voidInvoice']>){return this.request<C.TradeInvoice>(`/trade/invoices/${id}/void`, 'POST',input,key);}
  listPayments(...[page]:Parameters<C.TradeAPI['listPayments']>){return this.request<C.Page<C.PaymentBatch>>(`/trade/payments?page=${page}`);}
  getPayment(...[id]:Parameters<C.TradeAPI['getPayment']>){return this.request<C.PaymentBatch>(`/trade/payments/${id}`);}
  createPayment(...[input,key]:Parameters<C.TradeAPI['createPayment']>){return this.request<C.PaymentBatch>(`/trade/payments`, 'POST',input,key);}
  updatePayment(...[id,input,key]:Parameters<C.TradeAPI['updatePayment']>){return this.request<C.PaymentBatch>(`/trade/payments/${id}`, 'PATCH',input,key);}
  submitPayment(...[id,input,key]:Parameters<C.TradeAPI['submitPayment']>){return this.request<C.PaymentBatch>(`/trade/payments/${id}/submit`, 'POST',input,key);}
  decidePayment(...[id,input,key]:Parameters<C.TradeAPI['decidePayment']>){return this.request<C.PaymentBatch>(`/trade/payments/${id}/decide`, 'POST',input,key);}
  executePayment(...[id,input,key]:Parameters<C.TradeAPI['executePayment']>){return this.request<C.PaymentBatch>(`/trade/payments/${id}/execute`, 'POST',input,key);}
  cancelPayment(...[id,input,key]:Parameters<C.TradeAPI['cancelPayment']>){return this.request<C.PaymentBatch>(`/trade/payments/${id}/cancel`, 'POST',input,key);}
  paymentApprovers(...[]:Parameters<C.TradeAPI['paymentApprovers']>){return this.request<{id:string;email:string}[]>(`/trade/payments/approvers`);}
  listCollections(...[page]:Parameters<C.TradeAPI['listCollections']>){return this.request<C.Page<C.CustomerCollection>>(`/trade/collections?page=${page}`);}
  createCollection(...[input,key]:Parameters<C.TradeAPI['createCollection']>){return this.request<C.CustomerCollection>(`/trade/collections`, 'POST',input,key);}
  subledgerReport(...[date]:Parameters<C.TradeAPI['subledgerReport']>){return this.request<C.SubledgerReport>(`/trade/subledgers?date=${date}`);}
  financialStatements(...[from,to]:Parameters<C.TradeAPI['financialStatements']>){return this.request<C.FinancialStatements>(`/trade/statements?from=${from}&to=${to}`);}
  tradeHistory(...[kind,id]:Parameters<C.TradeAPI['tradeHistory']>){return this.request<C.RecordHistory[]>(`/trade/history/${kind}/${id}`);}
  previewImport(...[input,key]:Parameters<C.OperationsAPI['previewImport']>){return this.request<C.ImportPreview>('/operations/imports/preview','POST',input,key);}
  commitImport(...[id,input,key]:Parameters<C.OperationsAPI['commitImport']>){return this.request<C.ImportResult>(`/operations/imports/${id}/commit`,'POST',input,key);}
  listPrivacyCases(page:number){return this.request<{items:C.PrivacyCase[];page:number}>(`/operations/privacy?page=${page}`);}
  createPrivacyCase(...[input,key]:Parameters<C.OperationsAPI['createPrivacyCase']>){return this.request<C.PrivacyCase>('/operations/privacy','POST',input,key);}
  privacyAction(...[id,input,key]:Parameters<C.OperationsAPI['privacyAction']>){return this.request<C.PrivacyCase>(`/operations/privacy/${id}/action`,'POST',input,key);}
  exportPrivacyCase(id:string){return this.request<C.PrivacyExport>(`/operations/privacy/${id}/export`,'POST');}

}
