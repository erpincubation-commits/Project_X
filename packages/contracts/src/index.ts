import { z } from 'zod';

export const customerInput = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/, 'Use 1–32 letters, numbers, hyphens or underscores.').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Enter the customer name.').max(160).refine(value => !/[\x00-\x1f\x7f]/.test(value), 'Control characters are not allowed.')
}).strict();
export const loginInput = z.object({
  email: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128)
}).strict();
export const passwordInput = z.string().min(12, 'Use at least 12 characters.').max(128)
  .refine(value => new TextEncoder().encode(value).length <= 72, 'Use at most 72 UTF-8 bytes.');
export const setupInput = z.object({ email: loginInput.shape.email, password: passwordInput, setupToken: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const mfaInput = z.object({ challenge: z.string().regex(/^[a-f0-9]{64}$/), code: z.string().trim().min(6).max(40) }).strict();
export const roleInput = z.enum(['admin', 'reader', 'identity_admin', 'auditor']);
export const createUserInput = z.object({ email: loginInput.shape.email, password: passwordInput, role: roleInput }).strict();
export const updateUserInput = z.object({ role: roleInput, active: z.boolean() }).strict();
export type Role = z.infer<typeof roleInput>;
export type Permission = 'customers.read' | 'customers.create' | 'users.manage' | 'audit.read';
export const rolePermissions: Record<Role, readonly Permission[]> = {
  admin: ['customers.read', 'customers.create', 'users.manage', 'audit.read'],
  reader: ['customers.read'], identity_admin: ['users.manage'], auditor: ['customers.read', 'audit.read']
};
export interface SetupStatus { setupRequired: boolean }
export interface AuthChallenge { challenge: string; mfaRequired: true; enrollment?: { secret: string; uri: string } }
export type MfaPrompt = Omit<AuthChallenge, 'challenge'>;
export interface SessionResult { token: string; user: User; recoveryCodes?: string[] }
export interface SignedIn { user: User; recoveryCodes?: string[] }
export interface ManagedUser { id: string; email: string; role: Role; active: boolean; mfaEnabled: boolean }
export interface AuditEvent { id: string; actorId: string | null; action: string; entityType: string; entityId: string; occurredAt: string; changes: unknown }
export type CustomerInput = z.infer<typeof customerInput>;
export interface Customer { code: string; name: string; createdAt: string }
export interface User { id: string; email: string; role: Role; permissions: readonly Permission[] }
export interface CustomerPage { items: Customer[]; total: number; page: number; pageSize: number }
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };
export interface DesktopAPI {
  openLogs(): Promise<Result<null>>;
  reportError(kind: 'render' | 'script' | 'promise' | 'action'): Promise<void>;
  getServer(): Promise<string>;
  connect(url: string): Promise<Result<{ status: string }>>;
  setupStatus(): Promise<Result<SetupStatus>>;
  setup(input: z.infer<typeof setupInput>): Promise<Result<MfaPrompt>>;
  login(input: z.infer<typeof loginInput>): Promise<Result<MfaPrompt>>;
  verifyMfa(input: { code: string }): Promise<Result<SignedIn>>;
  me(): Promise<Result<User>>;
  revokeSessions(): Promise<Result<null>>;
  listUsers(): Promise<Result<ManagedUser[]>>;
  createUser(input: z.infer<typeof createUserInput>): Promise<Result<ManagedUser>>;
  updateUser(id: string, input: z.infer<typeof updateUserInput>): Promise<Result<ManagedUser>>;
  listAudit(page: number): Promise<Result<{ items: AuditEvent[]; page: number }>>;
  logout(): Promise<Result<null>>;
  listCustomers(page: number): Promise<Result<CustomerPage>>;
  createCustomer(input: CustomerInput, requestId: string): Promise<Result<Customer>>;
}
