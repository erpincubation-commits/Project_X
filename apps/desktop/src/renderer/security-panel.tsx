import React, { useState } from 'react';
import type { AuditEvent, ManagedUser, Role, User, Result } from '@erp/contracts';

export function SecurityPanel({ user, expired }: { user: User; expired: () => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('reader');
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  function data<T>(result: Result<T>) { if (result.ok) return result.data; setError(result.error); if (result.status === 401) expired(); }
  async function run(work: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await work(); } catch { setError('The action could not be completed. Open diagnostic logs for support.'); } finally { setBusy(false); } }
  async function loadUsers() { const result = data(await window.erp.listUsers()); if (result) setUsers(result); }
  async function loadAudit(page: number) { const result = data(await window.erp.listAudit(page)); if (result) { setEvents(result.items); setAuditPage(page); } }
  const canManage = user.permissions.includes('users.manage');
  return <section className="card security-panel"><h2>Account security</h2>
    <p>Authenticator verification is required at every sign-in. Sessions expire after 30 minutes without activity or eight hours in total.</p>
    <button disabled={busy} className="secondary" onClick={() => void run(async () => { const result = await window.erp.revokeSessions(); if (result.ok) expired(); else data(result); })}>Sign out all my sessions</button>
    {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}
    {canManage && <><h2>User access</h2><p>New users enrol an authenticator before accessing the workspace. Changing access immediately revokes their existing sessions. You cannot change your own access.</p>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const result = data(await window.erp.createUser({ email, password, role })); setPassword(''); if (result) { setEmail(''); setMessage('Account created. Share its initial password through your approved secure channel.'); await loadUsers(); } }); }}>
        <label htmlFor="new-email">New user email</label><input id="new-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/>
        <label htmlFor="new-password">Initial password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/>
        <label htmlFor="new-role">Role</label><select id="new-role" value={role} onChange={event => setRole(event.target.value as Role)}><option value="reader">Read only</option>{user.role === 'admin' && <><option value="admin">Administrator</option><option value="identity_admin">Identity administrator</option><option value="auditor">Auditor</option></>}</select>
        <button disabled={busy}>Create account</button>
      </form>
      <button className="secondary" disabled={busy} onClick={() => void run(loadUsers)}>Refresh users</button>
      <div className="table-scroll"><table><caption>User accounts (up to 500)</caption><thead><tr><th>Email</th><th>Role</th><th>MFA</th><th>Access</th></tr></thead><tbody>{users.map(account => <tr key={account.id}><td>{account.email}</td><td><select aria-label={`Role for ${account.email}`} value={account.role} disabled={busy || account.id === user.id || user.role !== 'admin'} onChange={event => { const next = event.target.value as Role; void run(async () => { const result = data(await window.erp.updateUser(account.id, { role: next, active: account.active })); if (result) await loadUsers(); }); }}><option value="reader">Read only</option><option value="admin">Administrator</option><option value="identity_admin">Identity administrator</option><option value="auditor">Auditor</option></select></td><td>{account.mfaEnabled ? 'Enabled' : 'Enrolment required'}</td><td><button disabled={busy || account.id === user.id || (user.role !== 'admin' && account.role !== 'reader')} className="secondary" onClick={() => void run(async () => { const result = data(await window.erp.updateUser(account.id, { role: account.role, active: !account.active })); if (result) await loadUsers(); })}>{account.active ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table></div>
    </>}
    {user.permissions.includes('audit.read') && <><h2>Audit history</h2><button className="secondary" disabled={busy} onClick={() => void run(() => loadAudit(1))}>Refresh audit history</button><div className="table-scroll"><table><caption>Security and business events</caption><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Record</th></tr></thead><tbody>{events.map(event => <tr key={event.id}><td>{new Date(event.occurredAt).toLocaleString()}</td><td>{event.action}</td><td>{event.actorId || 'Unauthenticated'}</td><td>{event.entityType}: {event.entityId}</td></tr>)}</tbody></table></div><div className="pagination"><button className="secondary" disabled={busy || auditPage === 1} onClick={() => void run(() => loadAudit(auditPage - 1))}>Newer events</button><span>Page {auditPage}</span><button className="secondary" disabled={busy || events.length < 50} onClick={() => void run(() => loadAudit(auditPage + 1))}>Older events</button></div></>}
  </section>;
}
