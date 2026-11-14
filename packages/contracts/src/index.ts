import { z } from 'zod';

export const customerInput = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/, 'Use 1–32 letters, numbers, hyphens or underscores.').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Enter the customer name.').max(160).refine(value => !/[\x00-\x1f\x7f]/.test(value), 'Control characters are not allowed.')
}).strict();
export const loginInput = z.object({
  email: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128)
}).strict();
export type CustomerInput = z.infer<typeof customerInput>;
export interface Customer { code: string; name: string; createdAt: string }
export interface User { id: string; email: string; role: 'admin' | 'reader' }
export interface CustomerPage { items: Customer[]; total: number; page: number; pageSize: number }
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };
export interface DesktopAPI {
  getServer(): Promise<string>;
  connect(url: string): Promise<Result<{ status: string }>>;
  login(input: z.infer<typeof loginInput>): Promise<Result<User>>;
  logout(): Promise<Result<null>>;
  listCustomers(page: number): Promise<Result<CustomerPage>>;
  createCustomer(input: CustomerInput, requestId: string): Promise<Result<Customer>>;
}
