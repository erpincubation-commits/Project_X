import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CustomerPage, Result, User, MfaPrompt } from '@erp/contracts';
import './styles.css';
import './security.css';
import { ErrorBoundary, reportRendererError } from './error-boundary';
import { SecurityPanel } from './security-panel';
import { ProcurementWorkspace } from './procurement-workspace';

window.addEventListener('error', () => reportRendererError('script'));
window.addEventListener('unhandledrejection', event => { event.preventDefault(); reportRendererError('promise'); });

function App() {
  const [server, setServer] = useState('http://127.0.0.1:3001');
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupToken, setSetupToken] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfa, setMfa] = useState<MfaPrompt | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [workspace,setWorkspace] = useState<'customers'|'procurement'>('customers');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<CustomerPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => { window.erp.getServer().then(setServer).catch(() => setError('Could not load the saved server address. Restart the app.')); }, []);
  function clearSession() { setUser(null); setCustomers(null); setMfa(null); setRecoveryCodes([]); setCode(''); setName(''); setSecurityOpen(false); pending.current = null; }
  useEffect(() => {
    if (!user) return;
    let lastActivity = Date.now(), lastCheck = Date.now();
    const check = async () => { if (Date.now() - lastCheck < 60000) return; lastCheck = Date.now(); const result = await window.erp.me(); if (!result.ok && result.status === 401) { clearSession(); setError('Your session has expired. Sign in again.'); } };
    const activity = () => { lastActivity = Date.now(); void check(); };
    const focus = () => { void check(); };
    window.addEventListener('pointerdown', activity); window.addEventListener('keydown', activity); window.addEventListener('focus', focus);
    const timer = window.setInterval(() => { if (Date.now() - lastActivity > 30 * 60000) { void window.erp.logout(); clearSession(); setMessage('Signed out after 30 minutes without activity.'); } }, 15000);
    return () => { window.clearInterval(timer); window.removeEventListener('pointerdown', activity); window.removeEventListener('keydown', activity); window.removeEventListener('focus', focus); };
  }, [user?.id]);

  function resultData<T>(result: Result<T>): T | undefined {
    if (result.ok) return result.data;
    setError(result.error);
    if (result.status === 401 && user) clearSession();
    return undefined;
  }
  async function perform(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch { reportRendererError('action'); setError('The desktop could not complete this action. Open diagnostic logs or restart the app and try again.'); }
    finally { setBusy(false); }
  }
  async function load(target = page) {
    const data = resultData(await window.erp.listCustomers(target));
    if (data) { setCustomers(data); setPage(target); }
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    await perform(async () => {
      if (setupRequired && password !== confirmPassword) { setError('The passwords do not match.'); return; }
      const prompt = resultData(setupRequired ? await window.erp.setup({ email, password, setupToken }) : await window.erp.login({ email, password }));
      setPassword(''); setConfirmPassword(''); setSetupToken('');
      if (prompt) { setMfa(prompt); setSetupRequired(false); }
    });
  }
  async function createCustomer(event: React.FormEvent) {
    event.preventDefault();
    await perform(async () => {
      const input = { code: code.trim().toUpperCase(), name: name.trim() };
      const payload = JSON.stringify(input);
      if (pending.current?.payload !== payload) pending.current = { payload, key: crypto.randomUUID() };
      const customer = resultData(await window.erp.createCustomer(input, pending.current.key));
      if (customer) {
        setCode(''); setName(''); pending.current = null;
        setMessage(`Customer ${customer.code} saved to the shared database.`);
        await load(1);
      }
    });
  }

  return <div className="app">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><span>SMB ERP<small>DESKTOP</small></span></div>
      <div className="nav-label">WORKSPACE</div>{user ? <>{user.permissions.includes('customers.read')&&<button className="module-nav" aria-pressed={workspace==='customers'&&!securityOpen} onClick={()=>{setWorkspace('customers');setSecurityOpen(false);}}>Customers</button>}{user.permissions.includes('masters.read')&&<button className="module-nav" aria-pressed={workspace==='procurement'&&!securityOpen} onClick={()=>{setWorkspace('procurement');setSecurityOpen(false);}}>Purchasing</button>}</> : <div className="nav-current">Connect</div>}
      <div className="sidebar-note"><strong>Shared workspace</strong><p>Customer records are stored on your company server.</p><span>Development release</span></div>
    </aside>
    <main><header><div><span className="eyebrow">SHARED WORKSPACE</span><h1>{user ? (securityOpen?'Account security':workspace==='procurement'?'Purchasing workspace':user.permissions.includes('customers.read')?'Your customers':'Account administration') : 'Connect to your workspace'}</h1><p>{user ? `${user.email} · ${user.role.replaceAll('_', ' ')}` : 'Sign in to your company server to get started.'}</p></div>
      {user && <button disabled={busy} className="secondary" onClick={() => perform(async () => { const result = await window.erp.logout(); clearSession(); if (!result.ok) setMessage('Signed out on this device. The server session will expire automatically.'); })}>Sign out</button>}
    </header>
    {error && <div className="notice error" role="alert">{error} <button className="secondary" onClick={() => void window.erp.openLogs()}>Open diagnostic logs</button></div>}
    {message && <div className="notice success" role="status">{message}</div>}
    {!user ? <div className="setup-grid"><section className="card"><span className="eyebrow">01 / SERVER</span><h2>Connect to the server</h2><p>Use localhost on this computer, or the HTTPS address supplied by your administrator.</p>
      <form onSubmit={event => { event.preventDefault(); perform(async () => { const result = await window.erp.connect(server); setMfa(null); setVerificationCode(''); if (resultData(result)) { const status = resultData(await window.erp.setupStatus()); if (status) { setSetupRequired(status.setupRequired); setConnected(true); setMessage(status.setupRequired ? 'Server connected. Create the initial administrator account.' : 'Server connected. You can sign in.'); } else setConnected(false); } else setConnected(false); }); }}>
        <label htmlFor="server">Server address</label><input id="server" type="url" required value={server} onChange={event => { setServer(event.target.value); setConnected(false); setMfa(null); setVerificationCode(''); setPassword(''); setConfirmPassword(''); setSetupToken(''); setSetupRequired(false); }} placeholder="https://erp.company.local"/>
        <button disabled={busy}>{busy ? 'Please wait…' : 'Connect'}</button><span className="connection">{connected ? 'Server ready' : 'Not connected'}</span>
      </form></section>
      <section className="card"><span className="eyebrow">02 / ACCOUNT</span>{mfa ? <><h2>{mfa.enrollment ? 'Set up your authenticator' : 'Verify your sign-in'}</h2>
        {mfa.enrollment ? <><p>Add an account in your authenticator app using the setup key shown below. Choose a time-based, six-digit code.</p><label>Authenticator setup key</label><code className="secret-key">{mfa.enrollment.secret}</code><p>Keep this key private. This setup attempt expires after five minutes. If you return to sign in before completing setup, use the new key shown on the next attempt and remove the old unfinished account from your authenticator app.</p></> : <p>Enter a six-digit authenticator code or one of your unused recovery codes. Each authenticator code can be used once. This verification attempt expires after five minutes.</p>}
        <form onSubmit={event => { event.preventDefault(); void perform(async () => { const signed = resultData(await window.erp.verifyMfa({ code: verificationCode })); setVerificationCode(''); if (signed) { setMfa(null); setUser(signed.user); setRecoveryCodes(signed.recoveryCodes || []); setSecurityOpen(false);setWorkspace('customers');if (signed.user.permissions.includes('customers.read')) await load(1); else if(signed.user.permissions.includes('requests.read'))setWorkspace('procurement');else setSecurityOpen(true); } }); }}><label htmlFor="verification-code">Verification code</label><input id="verification-code" autoComplete="one-time-code" required maxLength={40} value={verificationCode} onChange={event => setVerificationCode(event.target.value)}/><button disabled={busy}>Verify code</button><button type="button" className="secondary" disabled={busy} onClick={() => { setMfa(null); setVerificationCode(''); }}>Back to sign in</button></form>
      </> : <><h2>{setupRequired ? 'Create initial administrator' : 'Sign in'}</h2><p>{setupRequired ? 'Use the private setup code supplied by the server administrator. Choose a password of at least 12 characters and at most 72 UTF-8 bytes.' : 'Use the account created by your administrator.'}</p><form onSubmit={signIn}>
        {setupRequired && <><label htmlFor="setup-code">Administrator setup code</label><input id="setup-code" type="password" autoComplete="off" required maxLength={64} value={setupToken} onChange={event => setSetupToken(event.target.value)}/></>}
        <label htmlFor="email">Email</label><input id="email" autoComplete="username" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/>
        <label htmlFor="password">Password</label><input id="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} type="password" required minLength={setupRequired ? 12 : 1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/>
        {setupRequired && <><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></>}
        <button disabled={busy || !connected}>{busy ? 'Please wait…' : setupRequired ? 'Create administrator' : 'Sign in'}</button>
      </form></>}</section></div> : recoveryCodes.length ? <section className="card recovery-panel"><h2>Save your recovery codes</h2><p>These eight single-use codes are shown once. Store them privately outside this computer before continuing. You still need your password when using a recovery code.</p><ul>{recoveryCodes.map(value => <li key={value}><code>{value}</code></li>)}</ul><button onClick={() => setRecoveryCodes([])}>I have saved my recovery codes</button></section> : <>
      <div className="toolbar"><button className="secondary" onClick={() => setSecurityOpen(!securityOpen)}>{securityOpen ? 'Back to workspace' : 'Account security and access'}</button></div>
      {securityOpen ? <SecurityPanel user={user} expired={() => { clearSession(); setMessage('Your sessions were ended. Sign in again.'); }}/> : workspace==='procurement'&&user.permissions.includes('masters.read')?<ProcurementWorkspace user={user} expired={()=>{clearSession();setError('Your session has expired. Sign in again.');}}/>:user.permissions.includes('customers.read') ? <>
      <div className="toolbar"><span className="connection">Connected to {server}</span><button disabled={busy} className="secondary" onClick={() => perform(() => load())}>Refresh customers</button></div>
      {user.permissions.includes('customers.create') && <section className="card create-card"><h2>Add a customer</h2><form onSubmit={createCustomer} className="customer-form"><div><label htmlFor="code">Customer code</label><input id="code" required maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" placeholder="CUST-001" value={code} onChange={event => setCode(event.target.value)}/></div><div><label htmlFor="name">Customer name</label><input id="name" required maxLength={160} placeholder="Customer legal or trading name" value={name} onChange={event => setName(event.target.value)}/></div><button disabled={busy}>{busy ? 'Please wait…' : 'Save customer'}</button></form></section>}
      <section className="card register"><div className="table-heading"><h2>Customer register</h2><span>{customers?.total ?? 0} records</span></div>
        <table><caption className="sr-only">Shared customer records</caption><thead><tr><th scope="col">Code</th><th scope="col">Customer name</th><th scope="col">Created</th></tr></thead><tbody>{customers?.items.map(customer => <tr key={customer.code}><td><strong>{customer.code}</strong></td><td>{customer.name}</td><td>{new Date(customer.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
        {customers?.items.length === 0 && <p className="empty">No customers on this page. {user.role === 'admin' ? 'Add your first customer above.' : 'Ask an administrator to add customers.'}</p>}
        <div className="pagination"><button className="secondary" disabled={busy || page === 1} onClick={() => perform(() => load(page - 1))}>Previous</button><span>Page {page}</span><button className="secondary" disabled={busy || !customers || page * customers.pageSize >= customers.total} onClick={() => perform(() => load(page + 1))}>Next</button></div>
      </section>
      </> : <p>Your role provides account administration access. Open Account security and access to continue.</p>}
    </>}
    <footer>SMB ERP · On-premises desktop workspace <button className="secondary" onClick={() => void window.erp.openLogs()}>Diagnostic logs</button></footer></main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
