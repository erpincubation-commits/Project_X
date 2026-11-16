import React, { useEffect, useRef, useState } from 'react';
import type { User, Result, BooksOverview, RecordHistory, BooksHistoryKind } from '@erp/contracts';
import { BooksMasters, Journals } from './books-finance';
import { StockWorkspace, Reconciliation } from './books-stock';
import { BankWorkspace } from './books-bank';
import './books.css';
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function clean(value:string){return value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value;}
export interface BooksContext {
 user:User;busy:boolean;overview:BooksOverview;reload():Promise<void>;error(message:string):void;
 read<T>(result:Result<T>):T|undefined;
 run(work:()=>Promise<void>):Promise<void>;
 mutate<T>(operation:string,payload:unknown,send:(key:string)=>Promise<Result<T>>):Promise<T|undefined>;
}
export function BooksWorkspace({user,expired}:{user:User;expired:()=>void}){
 const [overview,setOverview]=useState<BooksOverview|null>(null),[tab,setTab]=useState(user.permissions.includes('books.read')?'Chart & periods':'Warehouses & stock'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(new Map<string,string>()),running=useRef(false);
 function read<T>(result:Result<T>){if(result.ok)return result.data;setError(result.error);if(result.status===401)expired();}
 async function reload(){const result=read(await window.erp.booksOverview());if(result)setOverview(result);}
 async function run(work:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');try{await work();}catch{setError('The action could not complete. Refresh the record before retrying.');}finally{running.current=false;setBusy(false);}}
 async function mutate<T>(operation:string,payload:unknown,send:(key:string)=>Promise<Result<T>>){const fingerprint=operation+JSON.stringify(payload);let key=pending.current.get(fingerprint);if(!key){key=crypto.randomUUID();pending.current.set(fingerprint,key);}const result=await send(key);if(result.ok){pending.current.delete(fingerprint);return result.data;}read(result);if(result.status===undefined||result.status>=500)setError(result.error+' The result may be uncertain. Check the register or retry unchanged; the retry key is retained while this workspace remains open.');}
 useEffect(()=>{void run(reload);},[]);
 const ctx:BooksContext|null=overview?{user,busy,overview,reload,error:setError,read,run,mutate}:null;
 return <section className="procurement books"><div className="module-tabs" aria-label="Accounting sections">{(user.permissions.includes('books.read')?['Chart & periods','Journals','Warehouses & stock','Reconciliation','Bank statements']:['Warehouses & stock','Reconciliation']).map(value=><button key={value} className={tab===value?'':'secondary'} aria-pressed={tab===value} disabled={busy||(!overview?.configured&&value!=='Chart & periods')} onClick={()=>{setError('');setTab(value);}}>{value}</button>)}</div>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {!ctx?<p>Loading accounting workspace… <button disabled={busy} onClick={()=>void run(reload)}>Retry connection</button></p>:!ctx.overview.configured||tab==='Chart & periods'?<BooksMasters ctx={ctx}/>:tab==='Journals'?<Journals ctx={ctx}/>:tab==='Warehouses & stock'?<StockWorkspace ctx={ctx}/>:tab==='Reconciliation'?<Reconciliation ctx={ctx}/>:<BankWorkspace ctx={ctx}/>}
 </section>;
}
export function Field({label,...props}:React.InputHTMLAttributes<HTMLInputElement>&{label:string}){return <label>{label}<input aria-label={label} {...props}/></label>;}
export function BookHistory({ctx,kind,id}:{ctx:BooksContext;kind:BooksHistoryKind;id:string}){const [records,setRecords]=useState<RecordHistory[]|null>(null);useEffect(()=>setRecords(null),[kind,id]);return <div className="record-history"><button type="button" className="secondary" disabled={ctx.busy} onClick={()=>void ctx.run(async()=>{const data=ctx.read(await window.erp.booksHistory(kind,id));if(data)setRecords(data);})}>Load record history</button>{records?.map(row=><details key={row.id}><summary>Version {row.version} · {row.action} · {row.actorEmail} · {new Date(row.occurredAt).toLocaleString()}</summary><pre>{JSON.stringify(row.snapshot,null,2)}</pre></details>)}</div>;}
export function BookPager({page,total,ctx,load}:{page:number;total:number;ctx:BooksContext;load:(page:number)=>Promise<void>}){return <div className="pagination"><button className="secondary" disabled={ctx.busy||page<=1} onClick={()=>void ctx.run(()=>load(page-1))}>Previous page</button><span>Page {page} · {total} records</span><button className="secondary" disabled={ctx.busy||page*20>=total} onClick={()=>void ctx.run(()=>load(page+1))}>Next page</button></div>;}
