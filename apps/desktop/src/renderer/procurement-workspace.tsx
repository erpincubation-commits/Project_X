import React, { useEffect, useRef, useState } from 'react';
import { supplierInput, itemInput, purchaseRequestInput, decideRequestInput, type User, type Result, type Supplier, type Item, type Page, type ProcurementQuery, type RecordHistory, type PurchaseRequest, type PurchaseRequestInput, type Approver } from '@erp/contracts';
import './procurement.css';

interface Context {
  user: User; busy: boolean;
  read<T>(result: Result<T>): T | undefined;
  run(work: () => Promise<void>): Promise<void>;
  mutate<T>(operation: string,input: unknown,send:(key:string)=>Promise<Result<T>>): Promise<T | undefined>;
  error(message: string): void;
}
export function ProcurementWorkspace({ user, expired }: { user: User; expired: () => void }) {
  const [tab,setTab]=useState<'requests'|'suppliers'|'items'>('requests');
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  const keys=useRef(new Map<string,string>());
  function read<T>(result: Result<T>) { if(result.ok) return result.data; setError(result.error); if(result.status===401) expired(); }
  async function run(work:()=>Promise<void>) { setBusy(true); setError(''); try { await work(); } catch { setError('The action could not be completed. Check the server record before retrying any change.'); } finally { setBusy(false); } }
  async function mutate<T>(operation:string,input:unknown,send:(key:string)=>Promise<Result<T>>) {
    const fingerprint=operation+JSON.stringify(input); let key=keys.current.get(fingerprint);
    if(!key) { key=crypto.randomUUID(); keys.current.set(fingerprint,key); }
    const result=await send(key);
    if(result.ok) { keys.current.delete(fingerprint); return result.data; }
    read(result);
    if(result.status===undefined || result.status>=500) setError(result.error+' The save outcome may be uncertain. Check the register or retry the unchanged action; its retry key is retained while this workspace stays open.');
    return undefined;
  }
  const ctx:Context={user,busy,read,run,mutate,error:setError};
  return <section className="procurement"><div className="module-tabs" role="group" aria-label="Purchasing sections">{(['requests','suppliers','items'] as const).map(value=><button key={value} className={tab===value?'':'secondary'} aria-pressed={tab===value} disabled={busy} onClick={()=>{setError('');setTab(value);}}>{value==='requests'?'Purchase requests':value==='suppliers'?'Suppliers':'Items'}</button>)}</div>
    {error && <div className="notice error" role="alert">{error}</div>}
    {tab==='requests'?<Requests ctx={ctx}/>:<Masters key={tab} kind={tab==='suppliers'?'supplier':'item'} ctx={ctx}/>}
  </section>;
}
function Pager({page,total,busy,change}:{page:number;total:number;busy:boolean;change:(page:number)=>void}) { return <div className="pagination"><button className="secondary" disabled={busy||page<=1} onClick={()=>change(page-1)}>Previous page</button><span>Page {page} · {total} records</span><button className="secondary" disabled={busy||page*20>=total} onClick={()=>change(page+1)}>Next page</button></div>; }
function History({records}:{records:RecordHistory[]}) { return <section className="card record-history"><h3>Record history</h3><p>Latest 200 versions. Expand a version to see the saved record.</p>{records.length===0?<p>No history loaded.</p>:records.map(record=><details key={record.id}><summary>Version {record.version} · {record.action} · {record.actorEmail} · {new Date(record.occurredAt).toLocaleString()}</summary><pre>{JSON.stringify(record.snapshot,null,2)}</pre></details>)}</section>; }

function Masters({kind,ctx}:{kind:'supplier'|'item';ctx:Context}) {
  const [records,setRecords]=useState<Page<Supplier|Item>|null>(null),[page,setPage]=useState(1),[search,setSearch]=useState(''),[activeOnly,setActiveOnly]=useState(false);
  const [selected,setSelected]=useState<Supplier|Item|null>(null),[history,setHistory]=useState<RecordHistory[]|null>(null);
  const blank={code:'',name:'',contactEmail:'',phone:'',paymentTermsDays:30,unit:'EA',description:'',active:true};
  const [form,setForm]=useState(blank);
  const canManage=ctx.user.permissions.includes('masters.manage');
  async function load(target=page) { const query={page:target,search,activeOnly:activeOnly?'true' as const:'false' as const}; const result=ctx.read<Page<Supplier|Item>>(kind==='supplier'?await window.erp.listSuppliers(query):await window.erp.listItems(query)); if(result) { setRecords(result);setPage(target); } }
  useEffect(()=>{void ctx.run(()=>load(1));},[]);
  function select(record:Supplier|Item|null) { setSelected(record);setHistory(null);setForm(record?{...blank,...record}:blank); }
  async function save(event:React.FormEvent) {
    event.preventDefault();
    await ctx.run(async()=> {
      const raw=kind==='supplier'?{code:form.code,name:form.name,contactEmail:form.contactEmail,phone:form.phone,paymentTermsDays:Number(form.paymentTermsDays),active:form.active}:{code:form.code,name:form.name,description:form.description,unit:form.unit,active:form.active};
      if(kind==='supplier') {
        const parsed=supplierInput.safeParse(raw); if(!parsed.success) {ctx.error(parsed.error.issues[0].message);return;}
        const {code,...fields}=parsed.data; const payload=selected?{...fields,version:selected.version}:parsed.data;
        const result=await ctx.mutate(`supplier:${selected?.id||'create'}`,payload,key=>selected?window.erp.updateSupplier(selected.id,{...fields,version:selected.version},key):window.erp.createSupplier(parsed.data,key));
        if(result) {select(null);await load(1);}
      } else {
        const parsed=itemInput.safeParse(raw); if(!parsed.success) {ctx.error(parsed.error.issues[0].message);return;}
        const {code,...fields}=parsed.data; const payload=selected?{...fields,version:selected.version}:parsed.data;
        const result=await ctx.mutate(`item:${selected?.id||'create'}`,payload,key=>selected?window.erp.updateItem(selected.id,{...fields,version:selected.version},key):window.erp.createItem(parsed.data,key));
        if(result) {select(null);await load(1);}
      }
    });
  }
  return <><section className="card"><h2>{kind==='supplier'?'Supplier register':'Item register'}</h2><form className="filter-bar" onSubmit={event=>{event.preventDefault();void ctx.run(()=>load(1));}}><label>Search {kind}s<input value={search} maxLength={100} onChange={event=>setSearch(event.target.value)}/></label><label className="check-label"><input type="checkbox" checked={activeOnly} onChange={event=>setActiveOnly(event.target.checked)}/>Active only</label><button disabled={ctx.busy}>Refresh {kind}s</button></form>
    <div className="table-scroll"><table><caption>{kind==='supplier'?'Suppliers':'Items'}</caption><thead><tr><th>Code</th><th>Name</th><th>{kind==='supplier'?'Terms':'Unit'}</th><th>Status</th><th>Version</th><th>Actions</th></tr></thead><tbody>{records?.items.map(record=><tr key={record.id}><td>{record.code}</td><td>{record.name}</td><td>{kind==='supplier'?`${(record as Supplier).paymentTermsDays} days`:(record as Item).unit}</td><td>{record.active?'Active':'Inactive'}</td><td>{record.version}</td><td>{canManage&&<button className="secondary" disabled={ctx.busy} aria-label={`Edit ${record.code}`} onClick={()=>select(record)}>Edit</button>}{ctx.user.permissions.includes('masters.history')&&<button className="secondary" disabled={ctx.busy} aria-label={`History ${record.code}`} onClick={()=>void ctx.run(async()=>{const result=ctx.read(await window.erp.recordHistory(kind,record.id));if(result)setHistory(result);})}>History</button>}</td></tr>)}</tbody></table></div>
    {records?.items.length===0&&<p>No matching {kind}s.</p>}<Pager page={page} total={records?.total||0} busy={ctx.busy} change={value=>void ctx.run(()=>load(value))}/>
  </section>
  {canManage&&<section className="card"><h2>{selected?`Edit ${kind} ${selected.code}`:`New ${kind}`}</h2>{selected&&<p>Editing version {selected.version}. To resolve a conflict, refresh the register and select Edit again. Codes cannot be changed.</p>}<form onSubmit={save}><fieldset disabled={ctx.busy}><div className="field-grid">
    <label>{kind==='supplier'?'Supplier code':'Item code'}<input required maxLength={32} disabled={!!selected} value={form.code} onChange={event=>setForm({...form,code:event.target.value})}/></label>
    <label>{kind==='supplier'?'Supplier name':'Item name'}<input required maxLength={160} value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label>
    {kind==='supplier'?<><label>Contact email<input type="email" maxLength={254} value={form.contactEmail} onChange={event=>setForm({...form,contactEmail:event.target.value})}/></label><label>Phone<input maxLength={40} value={form.phone} onChange={event=>setForm({...form,phone:event.target.value})}/></label><label>Payment terms (days)<input type="number" min={0} max={365} required value={form.paymentTermsDays} onChange={event=>setForm({...form,paymentTermsDays:Number(event.target.value)})}/></label></>:<><label>Unit of measure<input required maxLength={16} value={form.unit} onChange={event=>setForm({...form,unit:event.target.value})}/></label><label>Description<textarea maxLength={1000} value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></label></>}
    <label className="check-label"><input type="checkbox" checked={form.active} onChange={event=>setForm({...form,active:event.target.checked})}/>Active {kind}</label></div><button>Save {kind}</button>{selected&&<button type="button" className="secondary" onClick={()=>select(null)}>Cancel edit</button>}</fieldset></form></section>}
    {history&&<History records={history}/>}</>;
}

const emptyRequest:PurchaseRequestInput={title:'',justification:'',currency:'',supplierId:null,neededBy:null,lines:[{itemId:'',quantity:'1',estimatedUnitPrice:'0'}]};
const decimalText = (value:string) => value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value;
function Requests({ctx}:{ctx:Context}) {
  const [records,setRecords]=useState<Page<PurchaseRequest>|null>(null),[page,setPage]=useState(1),[search,setSearch]=useState(''),[status,setStatus]=useState<ProcurementQuery['status']>('ALL');
  const [selected,setSelected]=useState<PurchaseRequest|null>(null),[editing,setEditing]=useState(false),[form,setForm]=useState<PurchaseRequestInput>(emptyRequest);
  const [supplierOptions,setSuppliers]=useState<Supplier[]>([]),[itemOptions,setItems]=useState<Item[]>([]),[lookup,setLookup]=useState('');
  const [approvers,setApprovers]=useState<Approver[]>([]),[approverId,setApproverId]=useState(''),[reason,setReason]=useState(''),[history,setHistory]=useState<RecordHistory[]>([]);
  const canCreate=ctx.user.permissions.includes('requests.create');
  async function load(target=page) {const result=ctx.read(await window.erp.listPurchaseRequests({page:target,search,status}));if(result){setRecords(result);setPage(target);}}
  async function choices() {
    const suppliers=ctx.read(await window.erp.listSuppliers({page:1,search:lookup,activeOnly:'true'})); if(suppliers)setSuppliers(suppliers.items);
    const items=ctx.read(await window.erp.listItems({page:1,search:lookup,activeOnly:'true'})); if(items)setItems(items.items);
    if(canCreate){const result=ctx.read(await window.erp.listApprovers());if(result)setApprovers(result);}
  }
  useEffect(()=>{void ctx.run(async()=>{await load(1);await choices();});},[]);
  function show(record:PurchaseRequest) {setSelected(record);setEditing(false);setReason('');setApproverId(record.approverId||'');setHistory([]);setRecords(previous=>{if(!previous||!previous.items.some(item=>item.id===record.id))return previous;const visible=status==='ALL'||status===record.status;return {...previous,items:visible?previous.items.map(item=>item.id===record.id?record:item):previous.items.filter(item=>item.id!==record.id),total:previous.total-(visible?0:1)};});}
  async function open(id:string) {const record=ctx.read(await window.erp.getPurchaseRequest(id));if(record){show(record);const versions=ctx.read(await window.erp.recordHistory('purchase_request',id));if(versions)setHistory(versions);}}
  function edit(record:PurchaseRequest|null) {setSelected(record);setEditing(true);setForm(record?{title:record.title,justification:record.justification,currency:record.currency,supplierId:record.supplierId,neededBy:record.neededBy,lines:record.lines.map(line=>({itemId:line.itemId,quantity:decimalText(line.quantity),estimatedUnitPrice:decimalText(line.estimatedUnitPrice)}))}:{...emptyRequest,lines:[{...emptyRequest.lines[0]}]});}
  async function save(event:React.FormEvent) {event.preventDefault();await ctx.run(async()=>{
    const parsed=purchaseRequestInput.safeParse(form);if(!parsed.success){ctx.error(parsed.error.issues[0].message);return;}
    const payload=selected?{...parsed.data,version:selected.version}:parsed.data;
    const record=await ctx.mutate(`request:${selected?.id||'create'}`,payload,key=>selected?window.erp.updatePurchaseRequest(selected.id,{...parsed.data,version:selected.version},key):window.erp.createPurchaseRequest(parsed.data,key));
    if(record){show(record);await open(record.id);await load(1);}
  });}
  async function submit() {if(!selected)return;await ctx.run(async()=>{if(!approverId){ctx.error('Select an independent approver.');return;}const input={version:selected.version,approverId};const record=await ctx.mutate(`submit:${selected.id}`,input,key=>window.erp.submitPurchaseRequest(selected.id,input,key));if(record){show(record);await open(record.id);await load();}});}
  async function decide(decision:'APPROVED'|'REJECTED') {if(!selected)return;await ctx.run(async()=>{const parsed=decideRequestInput.safeParse({version:selected.version,decision,reason});if(!parsed.success){ctx.error(parsed.error.issues[0].message);return;}const record=await ctx.mutate(`decide:${selected.id}`,parsed.data,key=>window.erp.decidePurchaseRequest(selected.id,parsed.data,key));if(record){show(record);await open(record.id);await load();}});}
  const owned=selected?.requesterId===ctx.user.id;
  return <><section className="card"><div className="table-heading"><h2>Purchase request register</h2>{canCreate&&<button disabled={ctx.busy} onClick={()=>edit(null)}>New purchase request</button>}</div><form className="filter-bar" onSubmit={event=>{event.preventDefault();void ctx.run(()=>load(1));}}><label>Search requests<input value={search} maxLength={100} onChange={event=>setSearch(event.target.value)}/></label><label>Request status<select aria-label="Request status" value={status} onChange={event=>setStatus(event.target.value as ProcurementQuery['status'])}>{['ALL','DRAFT','SUBMITTED','APPROVED','REJECTED'].map(value=><option key={value}>{value}</option>)}</select></label><button disabled={ctx.busy}>Refresh requests</button></form>
    <div className="table-scroll"><table><caption>Your permitted purchase requests</caption><thead><tr><th>Request</th><th>Title</th><th>Status</th><th>Estimated total</th><th>Requester</th><th>Action</th></tr></thead><tbody>{records?.items.map(record=><tr key={record.id}><td>{record.number}</td><td>{record.title}</td><td><span className={`status-badge status-${record.status.toLowerCase()}`}>{record.status}</span></td><td>{record.currency} {decimalText(record.estimatedTotal)}</td><td>{record.requesterEmail}</td><td><button className="secondary" disabled={ctx.busy} aria-label={`Open ${record.number}`} onClick={()=>void ctx.run(()=>open(record.id))}>Open</button></td></tr>)}</tbody></table></div>{records?.items.length===0&&<p>No matching requests. Only your own or assigned requests are shown unless your role has broader read access.</p>}<Pager page={page} total={records?.total||0} busy={ctx.busy} change={value=>void ctx.run(()=>load(value))}/>
  </section>
  {editing&&<section className="card"><h2>{selected?`Revise ${selected.number}`:'Create purchase request'}</h2><p>Choose a three-letter currency code. Amounts are estimates; saving a draft does not create an order or accounting entry.</p><form className="filter-bar" onSubmit={event=>{event.preventDefault();void ctx.run(choices);}}><label>Find supplier or item<input maxLength={100} value={lookup} onChange={event=>setLookup(event.target.value)}/></label><button disabled={ctx.busy}>Search master data</button></form><p>Showing up to 20 matching suppliers and items; narrow the search to find another record.</p>
    <form onSubmit={save}><fieldset disabled={ctx.busy}><div className="field-grid"><label>Request title<input required maxLength={160} value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></label><label>Currency<input required minLength={3} maxLength={3} value={form.currency} onChange={event=>setForm({...form,currency:event.target.value.toUpperCase()})} placeholder="Three-letter code"/></label><label>Needed by<input type="date" value={form.neededBy||''} onChange={event=>setForm({...form,neededBy:event.target.value||null})}/></label><label>Preferred supplier (optional)<select aria-label="Preferred supplier (optional)" value={form.supplierId||''} onChange={event=>setForm({...form,supplierId:event.target.value||null})}><option value="">No preferred supplier</option>{form.supplierId&&!supplierOptions.some(value=>value.id===form.supplierId)&&<option value={form.supplierId}>{selected?.supplierName||'Selected supplier'} (not in current search)</option>}{supplierOptions.map(value=><option value={value.id} key={value.id}>{value.code} · {value.name}</option>)}</select></label></div><label>Justification<textarea required minLength={3} maxLength={2000} value={form.justification} onChange={event=>setForm({...form,justification:event.target.value})}/></label>
      <div className="table-scroll"><table><caption>Requested items</caption><thead><tr><th>Item</th><th>Quantity</th><th>Estimated unit price</th><th>Action</th></tr></thead><tbody>{form.lines.map((line,index)=><tr key={index}><td><select aria-label={`Item ${index+1}`} required value={line.itemId} onChange={event=>setForm({...form,lines:form.lines.map((value,i)=>i===index?{...value,itemId:event.target.value}:value)})}><option value="">Select an item</option>{line.itemId&&!itemOptions.some(value=>value.id===line.itemId)&&<option value={line.itemId}>{selected?.lines.find(value=>value.itemId===line.itemId)?.itemName||'Selected item'} (not in current search)</option>}{itemOptions.map(value=><option value={value.id} key={value.id}>{value.code} · {value.name} ({value.unit})</option>)}</select></td><td><input aria-label={`Quantity ${index+1}`} required inputMode="decimal" value={line.quantity} onChange={event=>setForm({...form,lines:form.lines.map((value,i)=>i===index?{...value,quantity:event.target.value}:value)})}/></td><td><input aria-label={`Unit price ${index+1}`} required inputMode="decimal" value={line.estimatedUnitPrice} onChange={event=>setForm({...form,lines:form.lines.map((value,i)=>i===index?{...value,estimatedUnitPrice:event.target.value}:value)})}/></td><td><button type="button" className="secondary" disabled={form.lines.length<=1} aria-label={`Remove line ${index+1}`} onClick={()=>setForm({...form,lines:form.lines.filter((_,i)=>i!==index)})}>Remove</button></td></tr>)}</tbody></table></div>
      <button type="button" className="secondary" disabled={form.lines.length>=100} onClick={()=>setForm({...form,lines:[...form.lines,{itemId:'',quantity:'1',estimatedUnitPrice:'0'}]})}>Add line</button><button>Save draft</button><button type="button" className="secondary" onClick={()=>setEditing(false)}>Cancel draft edit</button></fieldset></form>
  </section>}
  {selected&&!editing&&<section className="card request-detail"><div className="table-heading"><h2>{selected.number} · {selected.title}</h2><button className="secondary" disabled={ctx.busy} onClick={()=>void ctx.run(()=>open(selected.id))}>Refresh selected request</button></div><p><strong>Status: {selected.status}</strong> · Version {selected.version} · {selected.currency} {decimalText(selected.estimatedTotal)}</p><p>Requested by {selected.requesterEmail} · Approver: {selected.approverEmail||'Not assigned'}</p><p>Preferred supplier: {selected.supplierName||'Not specified'} · Needed by: {selected.neededBy||'Not specified'}</p><p>{selected.justification}</p>{selected.decisionReason&&<div className="notice" role="status">Decision reason: {selected.decisionReason}</div>}
    <div className="table-scroll"><table><caption>Saved request lines</caption><thead><tr><th>Item</th><th>Unit</th><th>Quantity</th><th>Unit price</th><th>Estimated total</th></tr></thead><tbody>{selected.lines.map(line=><tr key={line.id}><td>{line.itemCode} · {line.itemName} (master v{line.itemVersion})</td><td>{line.unit}</td><td>{decimalText(line.quantity)}</td><td>{decimalText(line.estimatedUnitPrice)}</td><td>{decimalText(line.estimatedTotal)}</td></tr>)}</tbody></table></div>
    {owned&&canCreate&&['DRAFT','REJECTED'].includes(selected.status)&&<button disabled={ctx.busy} onClick={()=>edit(selected)}>Revise request</button>}
    {owned&&canCreate&&selected.status==='DRAFT'&&<div className="approval-actions"><label>Independent approver<select aria-label="Independent approver" value={approverId} onChange={event=>setApproverId(event.target.value)}><option value="">Select an approver</option>{approvers.map(value=><option key={value.id} value={value.id}>{value.email}</option>)}</select></label>{!approvers.length&&<p>An administrator must provision an active business approver. Refresh the approver list when it is ready.</p>}<button className="secondary" disabled={ctx.busy} onClick={()=>void ctx.run(choices)}>Refresh approvers</button><button disabled={ctx.busy||!approverId} onClick={()=>void submit()}>Submit for approval</button></div>}
    {ctx.user.permissions.includes('requests.decide')&&selected.approverId===ctx.user.id&&!owned&&selected.status==='SUBMITTED'&&<div className="approval-actions"><label>Decision reason<textarea value={reason} maxLength={1000} onChange={event=>setReason(event.target.value)}/></label><p>A rejection needs a reason. Review the saved quantities and prices before deciding.</p><button disabled={ctx.busy} onClick={()=>void decide('APPROVED')}>Approve request</button><button className="secondary" disabled={ctx.busy} onClick={()=>void decide('REJECTED')}>Reject request</button></div>}
    <History records={history}/>
  </section>}
  </>;
}
