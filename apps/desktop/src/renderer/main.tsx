import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CustomerPage, Result, User } from '@erp/contracts';
import './styles.css';

function App() {
  const [server, setServer] = useState('http://127.0.0.1:3001');
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<CustomerPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => { window.erp.getServer().then(setServer).catch(() => setError('Could not load the saved server address. Restart the app.')); }, []);

  function resultData<T>(result: Result<T>): T | undefined {
    if (result.ok) return result.data;
    setError(result.error);
    if (result.status === 401) { setUser(null); setCustomers(null); }
    return undefined;
  }
  async function perform(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch { setError('The desktop could not complete this action. Restart the app and try again.'); }
    finally { setBusy(false); }
  }
  async function load(target = page) {
    const data = resultData(await window.erp.listCustomers(target));
    if (data) { setCustomers(data); setPage(target); }
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    await perform(async () => {
      const account = resultData(await window.erp.login({ email, password }));
      setPassword('');
      if (account) { setUser(account); await load(1); }
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
      <div className="nav-label">WORKSPACE</div><div className="nav-current">Customers</div>
      <div className="sidebar-note"><strong>Shared workspace</strong><p>Customer records are stored on your company server.</p><span>Development release</span></div>
    </aside>
    <main><header><div><span className="eyebrow">CUSTOMER ACCOUNTS</span><h1>{user ? 'Your customers' : 'Connect to your workspace'}</h1><p>{user ? `${user.email} · ${user.role === 'admin' ? 'Administrator' : 'Read only'}` : 'Sign in to your company server to get started.'}</p></div>
      {user && <button disabled={busy} className="secondary" onClick={() => perform(async () => { const result = await window.erp.logout(); setUser(null); setCustomers(null); setCode(''); setName(''); pending.current = null; if (!result.ok) setMessage('Signed out on this device. The server session will expire automatically.'); })}>Sign out</button>}
    </header>
    {error && <div className="notice error" role="alert">{error}</div>}
    {message && <div className="notice success" role="status">{message}</div>}
    {!user ? <div className="setup-grid"><section className="card"><span className="eyebrow">01 / SERVER</span><h2>Connect to the server</h2><p>Use localhost on this computer, or the HTTPS address supplied by your administrator.</p>
      <form onSubmit={event => { event.preventDefault(); perform(async () => { const result = await window.erp.connect(server); if (resultData(result)) { setConnected(true); setMessage('Server connected. You can sign in.'); } else setConnected(false); }); }}>
        <label htmlFor="server">Server address</label><input id="server" type="url" required value={server} onChange={event => { setServer(event.target.value); setConnected(false); }} placeholder="https://erp.company.local"/>
        <button disabled={busy}>{busy ? 'Please wait…' : 'Connect'}</button><span className="connection">{connected ? 'Server ready' : 'Not connected'}</span>
      </form></section>
      <section className="card"><span className="eyebrow">02 / ACCOUNT</span><h2>Sign in</h2><p>Use the account created by your administrator.</p><form onSubmit={signIn}>
        <label htmlFor="email">Email</label><input id="email" autoComplete="username" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/>
        <label htmlFor="password">Password</label><input id="password" autoComplete="current-password" type="password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/>
        <button disabled={busy || !connected}>{busy ? 'Please wait…' : 'Sign in'}</button>
      </form></section></div> : <>
      <div className="toolbar"><span className="connection">Connected to {server}</span><button disabled={busy} className="secondary" onClick={() => perform(() => load())}>Refresh customers</button></div>
      {user.role === 'admin' && <section className="card create-card"><h2>Add a customer</h2><form onSubmit={createCustomer} className="customer-form"><div><label htmlFor="code">Customer code</label><input id="code" required maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" placeholder="CUST-001" value={code} onChange={event => setCode(event.target.value)}/></div><div><label htmlFor="name">Customer name</label><input id="name" required maxLength={160} placeholder="Customer legal or trading name" value={name} onChange={event => setName(event.target.value)}/></div><button disabled={busy}>{busy ? 'Please wait…' : 'Save customer'}</button></form></section>}
      <section className="card register"><div className="table-heading"><h2>Customer register</h2><span>{customers?.total ?? 0} records</span></div>
        <table><caption className="sr-only">Shared customer records</caption><thead><tr><th scope="col">Code</th><th scope="col">Customer name</th><th scope="col">Created</th></tr></thead><tbody>{customers?.items.map(customer => <tr key={customer.code}><td><strong>{customer.code}</strong></td><td>{customer.name}</td><td>{new Date(customer.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
        {customers?.items.length === 0 && <p className="empty">No customers on this page. {user.role === 'admin' ? 'Add your first customer above.' : 'Ask an administrator to add customers.'}</p>}
        <div className="pagination"><button className="secondary" disabled={busy || page === 1} onClick={() => perform(() => load(page - 1))}>Previous</button><span>Page {page}</span><button className="secondary" disabled={busy || !customers || page * customers.pageSize >= customers.total} onClick={() => perform(() => load(page + 1))}>Next</button></div>
      </section>
    </>}
    <footer>SMB ERP · On-premises desktop workspace</footer></main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
