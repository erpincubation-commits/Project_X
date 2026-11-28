import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CustomerPage, Result, User, MfaPrompt } from '@erp/contracts';
import './styles.css';
import './security.css';
import { ErrorBoundary, reportRendererError } from './error-boundary';
import { SecurityPanel } from './security-panel';
import { ProcurementWorkspace } from './procurement-workspace';
import { BooksWorkspace } from './books-workspace';
import { OperationsWorkspace } from './operations-workspace';
import { TradeWorkspace, type PurchasingTradeTab } from './trade-workspace';
import './desk.css';

window.addEventListener('error', () => reportRendererError('script'));
window.addEventListener('unhandledrejection', event => { event.preventDefault(); reportRendererError('promise'); });

function NavigationIcon({name}:{name:'customers'|'procurement'|'books'|'trade'|'operations'}) {
  const shapes:Record<typeof name,React.ReactNode> = {
    customers:<><circle cx="8" cy="7" r="2.5"/><path d="M3.5 16v-1.2A4.5 4.5 0 0 1 8 10.3a4.5 4.5 0 0 1 4.5 4.5V16M13 4.5a2.5 2.5 0 0 1 0 5M14.5 11a4 4 0 0 1 2 3.5V16"/></>,
    procurement:<><path d="M3 6h14l-1 10H4L3 6ZM6 6V4a4 4 0 0 1 8 0v2M7 10h6"/></>,
    books:<><path d="M3 4.5A2.5 2.5 0 0 1 5.5 2H17v14H5.5A2.5 2.5 0 0 0 3 18V4.5ZM3 15.8A2.5 2.5 0 0 1 5.5 13H17M7 5.5h6M7 8.5h6"/></>,
    trade:<><path d="M4 2.5h9l3 3V17l-2-1-2 1-2-1-2 1-2-1-2 1V2.5ZM12.5 2.5V6H16M7 9h6M7 12h6"/></>,
    operations:<><path d="M10 2.5 16.5 5v4.5c0 3.5-2.2 5.8-6.5 8-4.3-2.2-6.5-4.5-6.5-8V5L10 2.5ZM7.2 9.8 9 11.5l3.8-4"/></>
  };
  return <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

function App() {
  const [server, setServer] = useState('http://127.0.0.1:3001');
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupToken, setSetupToken] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recovering, setRecovering] = useState(false); const [recoveryToken, setRecoveryToken] = useState(''); const [recoveryPassword, setRecoveryPassword] = useState(''); const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [mfa, setMfa] = useState<MfaPrompt | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [workspace,setWorkspace] = useState<'customers'|'procurement'|'books'|'trade'|'operations'>('customers');
  const [tradeStart,setTradeStart] = useState<PurchasingTradeTab|undefined>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<CustomerPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setError(''); setMessage(''); window.scrollTo(0,0); }, [workspace]);
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

  return <div className="app"><a className="skip-link" href="#main-content" onClick={event=>{event.preventDefault();document.getElementById('main-content')?.focus();}}>Skip to main content</a>
    <aside className="sidebar"><div className="brand"><span className="brand-mark" aria-hidden="true">X</span><span>Project X{' '}<small>ERP</small></span></div>
      <div className="nav-label">WORKSPACES</div>{user ? <nav aria-label="Workspaces">{user.permissions.includes('customers.read')&&<button className="module-nav" aria-pressed={workspace==='customers'&&!securityOpen} onClick={()=>{setWorkspace('customers');setSecurityOpen(false);}}><NavigationIcon name="customers"/>Customers</button>}{user.permissions.includes('masters.read')&&<button className="module-nav" aria-pressed={workspace==='procurement'&&!securityOpen} onClick={()=>{setWorkspace('procurement');setSecurityOpen(false);}}><NavigationIcon name="procurement"/>Purchasing</button>}{(user.permissions.includes('books.read')||user.permissions.includes('inventory.read'))&&<button className="module-nav" aria-pressed={workspace==='books'&&!securityOpen} onClick={()=>{setWorkspace('books');setSecurityOpen(false);}}><NavigationIcon name="books"/>Accounting & stock</button>}{(user.permissions.includes('orders.read')||user.permissions.includes('payments.read'))&&<button className="module-nav" aria-pressed={workspace==='trade'&&!securityOpen} onClick={()=>{setTradeStart(undefined);setWorkspace('trade');setSecurityOpen(false);}}><NavigationIcon name="trade"/>Orders & billing</button>}{(user.permissions.includes('imports.manage')||user.permissions.includes('privacy.manage'))&&<><div className="nav-label nav-label-secondary">ADMINISTRATION</div><button className="module-nav" aria-pressed={workspace==='operations'&&!securityOpen} onClick={()=>{setWorkspace('operations');setSecurityOpen(false);}}><NavigationIcon name="operations"/>Operations & privacy</button></>}</nav> : <div className="nav-current">Connect</div>}
      <div className="sidebar-note"><span className="sidebar-note-dot" aria-hidden="true"/><div><strong>Company workspace</strong><span>On-premises</span></div></div>
    </aside>
    <main id="main-content" tabIndex={-1}><div className="desk-topbar"><div className="desk-breadcrumb"><span>Project X ERP</span><span aria-hidden="true">/</span><strong>{user ? (securityOpen?'Account security':workspace==='procurement'?'Purchasing':workspace==='books'?'Accounting & stock':workspace==='trade'?'Orders & billing':workspace==='operations'?'Operations & privacy':'Customers'):'Connect'}</strong></div>{user&&<div className="desk-account"><span className="desk-identity">{user.email}</span>{!recoveryCodes.length&&<button className="secondary desk-account-button" onClick={() => setSecurityOpen(!securityOpen)}>{securityOpen ? 'Back to workspace' : 'Account security and access'}</button>}<button disabled={busy} className="secondary desk-signout" onClick={() => perform(async () => { const result = await window.erp.logout(); clearSession(); if (!result.ok) setMessage('Signed out on this device. The server session will expire automatically.'); })}>Sign out</button></div>}</div><header><div><span className="eyebrow">{user ? 'WORKSPACE' : 'PROJECT X ERP'}</span><h1>{user ? (securityOpen?'Account security':workspace==='procurement'?'Purchasing workspace':workspace==='books'?'Accounting & stock':workspace==='trade'?'Orders & billing':workspace==='operations'?'Operations & privacy':user.permissions.includes('customers.read')?'Your customers':'Account administration') : 'Connect to your workspace'}</h1><p>{user ? `${user.role.replaceAll('_', ' ')} access` : 'Sign in to your company server to get started.'}</p></div>
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
        <form onSubmit={event => { event.preventDefault(); void perform(async () => { const signed = resultData(await window.erp.verifyMfa({ code: verificationCode })); setVerificationCode(''); if (signed) { setMfa(null); setUser(signed.user); setRecoveryCodes(signed.recoveryCodes || []); setSecurityOpen(false);setWorkspace('customers');if (signed.user.permissions.includes('customers.read')) await load(1); else if(signed.user.permissions.includes('books.read')||signed.user.permissions.includes('inventory.read'))setWorkspace('books');else if(signed.user.permissions.includes('requests.read'))setWorkspace('procurement');else setSecurityOpen(true); } }); }}><label htmlFor="verification-code">Verification code</label><input id="verification-code" autoComplete="one-time-code" required maxLength={40} value={verificationCode} onChange={event => setVerificationCode(event.target.value)}/><button disabled={busy}>Verify code</button><button type="button" className="secondary" disabled={busy} onClick={() => { setMfa(null); setVerificationCode(''); }}>Back to sign in</button></form>
      </> : recovering ? <><h2>Recover access</h2><p>Enter the one-time token supplied privately by the administrator. The token expires after 15 minutes. Choose at least 12 characters and at most 72 UTF-8 bytes.</p><form onSubmit={event=>{event.preventDefault();void perform(async()=>{if(new TextEncoder().encode(recoveryPassword).length>72){setError('Use at most 72 UTF-8 bytes for the new password.');return;}if(recoveryPassword!==recoveryConfirm){setError('The passwords do not match.');return;} const result=await window.erp.redeemRecovery({token:recoveryToken,newPassword:recoveryPassword});setRecoveryToken('');setRecoveryPassword('');setRecoveryConfirm('');if(result.ok){setRecovering(false);setMessage('Recovery completed. Sign in with your new password and enrol a new authenticator.');}else if(!result.status || result.status>=500 || (result.status>=200 && result.status<300)){setError('The result is unknown. Try signing in with your new password; if it does not work, contact your administrator.');}else setError(result.error);});}}><label htmlFor="recovery-token">Recovery token</label><input id="recovery-token" type="password" autoComplete="off" required value={recoveryToken} onChange={e=>setRecoveryToken(e.target.value)}/><label htmlFor="recovery-password">New password</label><input id="recovery-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={recoveryPassword} onChange={e=>setRecoveryPassword(e.target.value)}/><label htmlFor="recovery-confirm">Confirm new password</label><input id="recovery-confirm" type="password" autoComplete="new-password" required value={recoveryConfirm} onChange={e=>setRecoveryConfirm(e.target.value)}/><button disabled={busy || !connected}>Complete recovery</button><button type="button" className="secondary" onClick={()=>{setRecovering(false);setRecoveryToken('');setRecoveryPassword('');setRecoveryConfirm('');}}>Back to sign in</button></form></> : <><h2>{setupRequired ? 'Create initial administrator' : 'Sign in'}</h2><p>{setupRequired ? 'Use the private setup code supplied by the server administrator. Choose a password of at least 12 characters and at most 72 UTF-8 bytes.' : 'Use the account created by your administrator.'}</p><form onSubmit={signIn}>
        {setupRequired && <><label htmlFor="setup-code">Administrator setup code</label><input id="setup-code" type="password" autoComplete="off" required maxLength={64} value={setupToken} onChange={event => setSetupToken(event.target.value)}/></>}
        <label htmlFor="email">Email</label><input id="email" autoComplete="username" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/>
        <label htmlFor="password">Password</label><input id="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} type="password" required minLength={setupRequired ? 12 : 1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/>
        {setupRequired && <><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></>}
        <button disabled={busy || !connected}>{busy ? 'Please wait…' : setupRequired ? 'Create administrator' : 'Sign in'}</button>
      </form>{!setupRequired && <button className="secondary" onClick={()=>setRecovering(true)}>Recover access</button>}</>}</section></div> : recoveryCodes.length ? <section className="card recovery-panel"><h2>Save your recovery codes</h2><p>These eight single-use codes are shown once. Store them privately outside this computer before continuing. You still need your password when using a recovery code.</p><ul>{recoveryCodes.map(value => <li key={value}><code>{value}</code></li>)}</ul><button onClick={() => setRecoveryCodes([])}>I have saved my recovery codes</button></section> : <>
      {securityOpen ? <SecurityPanel user={user} expired={(notice) => { clearSession(); setMessage(notice || 'Your sessions were ended. Sign in again.'); }}/> : workspace==='operations'&&(user.permissions.includes('imports.manage')||user.permissions.includes('privacy.manage'))?<OperationsWorkspace user={user} expired={()=>{clearSession();setError('Your session has expired. Sign in again.');}}/>:workspace==='trade'&&(user.permissions.includes('orders.read')||user.permissions.includes('payments.read'))?<TradeWorkspace user={user} initialTab={tradeStart} expired={()=>{clearSession();setError('Your session has expired. Sign in again.');}}/>:workspace==='books'&&(user.permissions.includes('books.read')||user.permissions.includes('inventory.read'))?<BooksWorkspace user={user} expired={()=>{clearSession();setError('Your session has expired. Sign in again.');}}/>:workspace==='procurement'&&user.permissions.includes('masters.read')?<ProcurementWorkspace user={user} openTrade={tab=>{setTradeStart(tab);setWorkspace('trade');}} expired={()=>{clearSession();setError('Your session has expired. Sign in again.');}}/>:user.permissions.includes('customers.read') ? <>
      <div className="customer-workspace"><div className="customer-intro"><div><span className="workspace-kicker">CUSTOMER DIRECTORY</span><h2>Customer register</h2><p>View shared customer records and maintain the details used by your team.</p></div><button disabled={busy} className="secondary" onClick={() => perform(() => load())}>Refresh customers</button></div>
      {user.permissions.includes('customers.create') && <section className="card create-card"><div className="section-heading"><div><h2>Add a customer</h2><p>Enter a unique code and the customer's legal or trading name.</p></div></div><form onSubmit={createCustomer} className="customer-form"><div><label htmlFor="code">Customer code</label><input id="code" required maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" placeholder="CUST-001" value={code} onChange={event => setCode(event.target.value)}/></div><div><label htmlFor="name">Customer name</label><input id="name" required maxLength={160} placeholder="Customer legal or trading name" value={name} onChange={event => setName(event.target.value)}/></div><button disabled={busy}>{busy ? 'Please wait…' : 'Save customer'}</button></form></section>}
      <section className="card register"><div className="table-heading"><div><h2>All customers</h2><p>Records available to your account</p></div><span>{customers ? `${customers.total} records` : 'Loading records'}</span></div>
        <table><caption className="sr-only">Shared customer records</caption><thead><tr><th scope="col">Code</th><th scope="col">Customer name</th><th scope="col">Created</th></tr></thead><tbody>{customers?.items.map(customer => <tr key={customer.code}><td><strong>{customer.code}</strong></td><td>{customer.name}</td><td>{new Date(customer.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
        {customers?.items.length === 0 && <p className="empty">No customers on this page. {user.role === 'admin' ? 'Add your first customer above.' : 'Ask an administrator to add customers.'}</p>}
        <div className="pagination"><button className="secondary" disabled={busy || page === 1} onClick={() => perform(() => load(page - 1))}>Previous</button><span>Page {page}</span><button className="secondary" disabled={busy || !customers || page * customers.pageSize >= customers.total} onClick={() => perform(() => load(page + 1))}>Next</button></div>
      </section></div>
      </> : <p>Your role provides account administration access. Open Account security and access to continue.</p>}
    </>}
    <footer>Project X ERP · On-premises workspace <button className="secondary" onClick={() => void window.erp.openLogs()}>Diagnostic logs</button></footer></main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
