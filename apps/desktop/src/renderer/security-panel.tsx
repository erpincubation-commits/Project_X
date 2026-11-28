import React, { useState } from 'react';
import { roleInput, type RecoveryCase, type AuditEvent, type ManagedUser, type Role, type User, type Result } from '@erp/contracts';
import './operations-security.css';

export function SecurityPanel({ user, expired }: { user: User; expired: (message?: string) => void }) {
  const [cases, setCases] = useState<RecoveryCase[]>([]); const [recoveryEmail, setRecoveryEmail] = useState(''); const [verified, setVerified] = useState(false); const [recoveryToken, setRecoveryToken] = useState('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [role, setRole] = useState<Role>('reader');
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  function data<T>(result: Result<T>) { if (result.ok) return result.data; setError(result.error); if (result.status === 401) expired(); }
  async function run(work: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await work(); } catch { setError('The action could not be completed. Open diagnostic logs for support.'); } finally { setBusy(false); } }
  async function loadUsers() { const result = data(await window.erp.listUsers()); if (result) setUsers(result); }
  async function loadAudit(page: number) { const result = data(await window.erp.listAudit(page)); if (result) { setEvents(result.items); setAuditPage(page); } }
  const canManage = user.permissions.includes('users.manage');
  return <section className="security-panel"><div className="security-intro"><div><span className="security-kicker">SECURITY CENTRE</span><h2>Account security</h2><p>Manage your sign-in and review access to the shared workspace.</p></div><div className="security-session"><strong>Session protection</strong><span>Multi-factor sign-in &middot; 30-minute idle timeout</span></div></div>
    <nav className="security-jump" aria-label="Security sections"><button type="button" onClick={()=>document.getElementById('security-password')?.scrollIntoView()}>Password &amp; sessions</button>{user.role==='admin'&&<button type="button" onClick={()=>document.getElementById('security-recovery')?.scrollIntoView()}>Identity recovery</button>}{canManage&&<button type="button" onClick={()=>document.getElementById('security-users')?.scrollIntoView()}>User access</button>}{user.permissions.includes('audit.read')&&<button type="button" onClick={()=>document.getElementById('security-audit')?.scrollIntoView()}>Audit history</button>}</nav>
    <p className="security-context">Multi-factor verification is required at every sign-in. Sessions expire after 30 minutes without activity or eight hours in total.</p>
    {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}
    <section className="security-task" aria-labelledby="security-password">
    <form onSubmit={event => { event.preventDefault(); void run(async () => {
      if (newPassword !== confirmation) { setError('The new passwords do not match.'); return; }
      const result = await window.erp.changePassword({ currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      if (result.ok) expired('Password changed. All sessions ended. Sign in with your new password and MFA.');
      else if (result.status === 401) expired(result.error);
      else data(result);
    }); }}>
      <h3 id="security-password">Change password</h3><p>Changing your password signs out all sessions. You will need your new password and MFA to sign in again.</p>
      <label htmlFor="current-password">Current password</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}/>
      <label htmlFor="change-new-password">New password</label><input id="change-new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)}/>
      <label htmlFor="change-confirm-password">Confirm new password</label><input id="change-confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)}/>
      <button disabled={busy}>Change password</button>
    </form>
    <div className="security-session-action"><div><strong>Active sessions</strong><p>End all of your sessions if you need to sign out everywhere.</p></div><button disabled={busy} className="secondary" onClick={() => void run(async () => { const result = await window.erp.revokeSessions(); if (result.ok) expired(); else data(result); })}>Sign out all my sessions</button></div>
    </section>
    {user.role === 'admin' && <section className="security-task" aria-labelledby="security-recovery"><h2 id="security-recovery">Identity recovery</h2><p>Independently verify identity using your approved procedure. A different administrator must independently verify and approve. Do not use this process for a restricted account or the last active administrator.</p>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const result = data(await window.erp.requestRecovery({ email: recoveryEmail, verified: true })); if(result) { setRecoveryEmail(''); setVerified(false); setMessage('Recovery request created. Ask another administrator to verify and approve it.'); const list=data(await window.erp.recoveryCases()); if(list)setCases(list); } }); }}>
        <label htmlFor="recovery-email">Account email for recovery</label><input id="recovery-email" type="email" required value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)}/>
        <label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> I independently verified the person's identity</label><button disabled={busy || !verified}>Request recovery</button>
      </form>
      <button className="secondary" disabled={busy} onClick={() => void run(async()=>{const list=data(await window.erp.recoveryCases());if(list)setCases(list);})}>Refresh recovery requests</button>
      <ul>{cases.map(item=><li key={item.id}>{item.email} - {item.status} <button className="secondary" disabled={busy || item.status!=='PENDING' || item.requestedBy===user.id} onClick={()=>void run(async()=>{ if(!window.confirm('Have you independently verified this person using your approved procedure?'))return; const approval=await window.erp.approveRecovery(item.id); if(!approval.ok && (!approval.status || approval.status>=500 || (approval.status>=200 && approval.status<300))){setError('The approval result is unknown. Cancel the request and start again.');} else {const result=data(approval); if(result){setRecoveryToken(result.token);setMessage('Deliver the one-time token privately using your verified channel. It expires in 15 minutes.');}} const list=data(await window.erp.recoveryCases());if(list)setCases(list);})}>Verify and approve</button> <button className="secondary" disabled={busy} onClick={()=>void run(async()=>{data(await window.erp.cancelRecovery(item.id));setRecoveryToken('');const list=data(await window.erp.recoveryCases());if(list)setCases(list);})}>Cancel recovery</button></li>)}</ul>
      {recoveryToken && <div className="notice"><p>Recovery token (shown once; deliver privately):</p><code>{recoveryToken}</code><button className="secondary" onClick={()=>setRecoveryToken('')}>Hide token</button></div>}
    </section>}
    {canManage && <section className="security-task" aria-labelledby="security-users"><h2 id="security-users">User access</h2><p>New users enrol an authenticator before accessing the workspace. Changing access immediately revokes their existing sessions. You cannot change your own access.</p>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const result = data(await window.erp.createUser({ email, password, role })); setPassword(''); if (result) { setEmail(''); setMessage('Account created. Share its initial password through your approved secure channel.'); await loadUsers(); } }); }}>
        <label htmlFor="new-email">New user email</label><input id="new-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/>
        <label htmlFor="new-password">Initial password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/>
        <label htmlFor="new-role">Role</label><select id="new-role" value={role} onChange={event => setRole(event.target.value as Role)}>{(user.role==='admin'?roleInput.options:['reader']).map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select>
        <button disabled={busy}>Create account</button>
      </form>
      <button className="secondary" disabled={busy} onClick={() => void run(loadUsers)}>Refresh users</button>
      <div className="table-scroll"><table><caption>User accounts (up to 500)</caption><thead><tr><th>Email</th><th>Role</th><th>MFA</th><th>Access</th></tr></thead><tbody>{users.map(account => <tr key={account.id}><td>{account.email}</td><td><select aria-label={`Role for ${account.email}`} value={account.role} disabled={busy || account.id === user.id || user.role !== 'admin'} onChange={event => { const next = event.target.value as Role; void run(async () => { const result = data(await window.erp.updateUser(account.id, { role: next, active: account.active })); if (result) await loadUsers(); }); }}>{roleInput.options.map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></td><td>{account.mfaEnabled ? 'Enabled' : 'Enrolment required'}</td><td><button disabled={busy || account.id === user.id || (user.role !== 'admin' && account.role !== 'reader')} className="secondary" onClick={() => void run(async () => { const result = data(await window.erp.updateUser(account.id, { role: account.role, active: !account.active })); if (result) await loadUsers(); })}>{account.active ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table></div>
    </section>}
    {user.permissions.includes('audit.read') && <section className="security-task" aria-labelledby="security-audit"><h2 id="security-audit">Audit history</h2><button className="secondary" disabled={busy} onClick={() => void run(() => loadAudit(1))}>Refresh audit history</button><div className="table-scroll"><table><caption>Security and business events</caption><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Record</th></tr></thead><tbody>{events.map(event => <tr key={event.id}><td>{new Date(event.occurredAt).toLocaleString()}</td><td>{event.action}</td><td>{event.actorId || 'Unauthenticated'}</td><td>{event.entityType}: {event.entityId}</td></tr>)}</tbody></table></div><div className="pagination"><button className="secondary" disabled={busy || auditPage === 1} onClick={() => void run(() => loadAudit(auditPage - 1))}>Newer events</button><span>Page {auditPage}</span><button className="secondary" disabled={busy || events.length < 50} onClick={() => void run(() => loadAudit(auditPage + 1))}>Older events</button></div></section>}
  </section>;
}
