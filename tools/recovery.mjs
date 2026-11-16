import { createReadStream, createWriteStream, existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
const magic=Buffer.from('ERPBACKUP1\n');
export function backupKey() {
 const value=process.env.ERP_BACKUP_KEY || (process.env.ERP_BACKUP_KEY_FILE ? readFileSync(process.env.ERP_BACKUP_KEY_FILE,'utf8').trim() : '');
 if(!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Set ERP_BACKUP_KEY_FILE to an independently secured 32-byte hex key file.');
 return Buffer.from(value,'hex');
}
function signature(value,key){return createHmac('sha256',key).update(JSON.stringify(value)).digest('hex');}
export function verifyManifest(manifest,key) {
 const {mac,...body}=manifest;
 if(!/^[a-f0-9]{64}$/.test(mac||'') || !timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(signature(body,key),'hex'))) throw new Error('Backup manifest authentication failed.');
 if(body.format!==1 || !Number.isSafeInteger(body.size) || body.size<magic.length+28 || !/^[a-f0-9]{64}$/.test(body.sha256)) throw new Error('Unsupported backup manifest.');
 return body;
}
function executable(name) {
 let bin=process.env.PG_BIN;
 if(!bin && process.platform==='win32') {
  const base=join(process.env.ProgramFiles||'C:/Program Files','PostgreSQL');
  if(existsSync(base)) bin=readdirSync(base).sort((a,b)=>Number(b)-Number(a)).map(v=>join(base,v,'bin')).find(p=>existsSync(join(p,'pg_dump.exe')));
 }
 return bin?join(bin,name+(process.platform==='win32'?'.exe':'')):name;
}
function pgEnvironment(url) {
 // Credentials are passed only in the child environment, never command-line arguments or reports.
 return {...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGSSLMODE:url.searchParams.get('sslmode')||'prefer',PGOPTIONS:url.searchParams.get('options')||'',PGCONNECT_TIMEOUT:'10'};
}
function childProcess(name,args,url) {
 const container=process.env.PG_CONTAINER;
 if(container&&!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(container)) throw new Error('Invalid PG_CONTAINER name.');
 const command=container?'docker':executable(name);
 const parameters=container?['exec','-i',...['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGOPTIONS','PGCONNECT_TIMEOUT'].flatMap(k=>['--env',k]),container,name,...args]:args;
 const child=spawn(command,parameters,{env:pgEnvironment(url),windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stderr.resume(); // PostgreSQL diagnostics may contain connection details; use sanitised errors.
 const done=new Promise((yes,no)=>{child.once('error',()=>no(new Error(`${name} could not start. Check PG_BIN.`)));child.once('exit',code=>code===0?yes():no(new Error(`${name} failed. Check tool/server versions, permissions and available disk space.`)));});
 done.catch(()=>{});
 const timer=setTimeout(()=>child.kill(),30*60*1000);timer.unref();done.finally(()=>clearTimeout(timer)).catch(()=>{});
 return {child,done};
}
async function archiveHash(file) {
 const hash=createHash('sha256');let size=0;
 for await(const chunk of createReadStream(file)){hash.update(chunk);size+=chunk.length;}
 return {sha256:hash.digest('hex'),size};
}
async function counts(client) {
 const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'erp\\_%' ESCAPE '\\' ORDER BY tablename")).rows;
 const result={};
 for(const {tablename} of tables) {
  if(!/^erp_[a-z0-9_]+$/.test(tablename)) throw new Error('Unexpected table name.');
  result[tablename]=(await client.query(`SELECT count(*)::text AS count FROM public."${tablename}"`)).rows[0].count;
 }
 return result;
}
export async function createBackup(connectionString,file,key) {
 const {Pool}=require('pg'),pool=new Pool({connectionString,connectionTimeoutMillis:5000}),client=await pool.connect();
 try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot=(await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
  const rowCounts=await counts(client);
  const versions=(await client.query('SELECT version FROM erp_schema_migrations ORDER BY version')).rows.map(r=>r.version);
  const serverVersion=(await client.query('SHOW server_version')).rows[0].server_version;
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(magic);
  const output=createWriteStream(file,{flags:'wx',mode:0o600});
  output.write(Buffer.concat([magic,iv]));
  const {child,done}=childProcess('pg_dump',['--format=custom','--no-owner','--no-privileges',`--snapshot=${snapshot}`],new URL(connectionString));child.stdin.end();
  try {await Promise.all([pipeline(child.stdout,cipher,output,{end:false}),done]);output.end(cipher.getAuthTag());await new Promise((yes,no)=>{output.once('finish',yes);output.once('error',no);});}
  catch(e){child.kill();output.destroy();throw e;}
  await client.query('COMMIT');
  const manifest={format:1,createdAt:new Date().toISOString(),serverVersion,versions,rowCounts,...await archiveHash(file)};
  writeFileSync(file+'.json',JSON.stringify({...manifest,mac:signature(manifest,key)},null,2),{flag:'wx',mode:0o600});
  return manifest;
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();await pool.end();}
}
async function decryptArchive(file,key,destination) {
 const {open,stat}=await import('node:fs/promises');const size=(await stat(file)).size;
 const handle=await open(file,'r');let header,tag;
 try {header=Buffer.alloc(magic.length+12);tag=Buffer.alloc(16);await handle.read(header,0,header.length,0);await handle.read(tag,0,16,size-16);}finally{await handle.close();}
 if(!header.subarray(0,magic.length).equals(magic)) throw new Error('Unsupported encrypted archive.');
 const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(magic.length));decipher.setAAD(magic);decipher.setAuthTag(tag);
 await pipeline(createReadStream(file,{start:header.length,end:size-17}),decipher,destination);
}
export async function restoreBackup(connectionString,file,name,key) {
 if(!/^erp_restore_[a-z0-9_]{1,40}$/.test(name)) throw new Error('Restore target must be a new database named erp_restore_<name>.');
 const source=new URL(connectionString);
 if(decodeURIComponent(source.pathname.slice(1))===name) throw new Error('Cannot restore over the configured ERP database.');
 const manifest=verifyManifest(JSON.parse(readFileSync(file+'.json','utf8')),key),actual=await archiveHash(file);
 if(actual.sha256!==manifest.sha256||actual.size!==manifest.size) throw new Error('Backup size or hash mismatch.');
 // Authenticate every byte before creating a database or sending SQL to PostgreSQL. No plaintext files.
 await decryptArchive(file,key,new Writable({write(_chunk,_encoding,callback){callback();}}));
 const {Pool}=require('pg'),owner=new Pool({connectionString,connectionTimeoutMillis:5000});let target;
 try {
  if((await owner.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount) throw new Error('Restore target already exists; nothing was overwritten.');
  await owner.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
  const url=new URL(source);url.pathname='/'+name;target=new Pool({connectionString:url.toString(),connectionTimeoutMillis:5000});
  const {child,done}=childProcess('pg_restore',['--dbname='+name,'--single-transaction','--exit-on-error','--no-owner','--no-privileges'],url);child.stdout.resume();
  try {await Promise.all([decryptArchive(file,key,child.stdin),done]);}catch(e){child.kill();throw e;}
  const restored=await counts(target);
  if(JSON.stringify(restored)!==JSON.stringify(manifest.rowCounts)) throw new Error('Restored row counts differ. Keep target quarantined.');
  const versions=(await target.query('SELECT version FROM erp_schema_migrations ORDER BY version')).rows.map(r=>r.version);
  if(JSON.stringify(versions)!==JSON.stringify(manifest.versions)) throw new Error('Restored migration versions differ.');
  const {migrationStatus}=require('../apps/server/dist/database/migrate.js');await migrationStatus(target);
  if(versions.includes(6)) {
   if((await target.query('SELECT 1 FROM erp_trade_reconciliation(current_date) WHERE difference<>0')).rowCount) throw new Error('Restored financial controls do not reconcile.');
   if((await target.query("SELECT 1 FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id WHERE j.status='POSTED' GROUP BY j.id HAVING sum(l.debit)<>sum(l.credit) LIMIT 1")).rowCount) throw new Error('Restored journals are unbalanced.');
   if((await target.query(`WITH entries AS (SELECT item_id,warehouse_id,sum(quantity) AS quantity,sum(value) AS value FROM erp_stock_entries GROUP BY item_id,warehouse_id)
    SELECT 1 FROM entries e FULL JOIN erp_stock_balances b USING(item_id,warehouse_id) WHERE coalesce(e.quantity,0)<>coalesce(b.quantity,0) OR coalesce(e.value,0)<>coalesce(b.value,0) LIMIT 1`)).rowCount) throw new Error('Restored stock projections do not reconcile.');
   if((await target.query(`SELECT 1 WHERE (SELECT coalesce(sum(value),0) FROM erp_stock_entries)<>
    (SELECT coalesce(sum(l.debit-l.credit),0) FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id JOIN erp_accounts a ON a.id=l.account_id WHERE j.status='POSTED' AND a.control='INVENTORY')`)).rowCount) throw new Error('Restored inventory and ledger differ.');
  }
  // Old bearer sessions and in-flight challenges must never become valid after recovery.
  await target.query('BEGIN');
  try {await target.query('DELETE FROM erp_sessions');await target.query('DELETE FROM erp_auth_challenges');await target.query("INSERT INTO erp_audit_events(actor_id,action,entity_type,entity_id,changes) VALUES(NULL,'recovery.restored','recovery',$1,$2)",[name,JSON.stringify({backupHash:manifest.sha256})]);await target.query('COMMIT');}catch(e){await target.query('ROLLBACK');throw e;}
  return {target:name,verified:true,sessionsRevoked:true,versions,backupHash:manifest.sha256};
 }finally{await target?.end();await owner.end();}
}
async function main() {
 require('../apps/server/dist/config.js');
 const command=process.argv[2];
 if(command==='key') {
  const folder=resolve(root,'secrets');mkdirSync(folder,{recursive:true});
  writeFileSync(join(folder,'backup-key'),randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});
  console.log('Created secrets/backup-key. Restrict its Windows ACL, escrow a separate copy, and set ERP_BACKUP_KEY_FILE. The key was not printed.');return;
 }
 if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.');
 const key=backupKey();
 if(command==='backup') {
  const folder=resolve(root,'.local/backups');mkdirSync(folder,{recursive:true});
  const file=process.argv[3]?resolve(process.argv[3]):join(folder,`erp-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.erpbak`);
  const manifest=await createBackup(process.env.DATABASE_URL,file,key);
  console.log(JSON.stringify({file,sha256:manifest.sha256,versions:manifest.versions,encrypted:true},null,2));
 }else if(command==='restore') {
  if(!process.argv[3]||!process.argv[4]) throw new Error('Usage: npm run db:restore -- <archive.erpbak> erp_restore_<newname>');
  console.log(JSON.stringify(await restoreBackup(process.env.DATABASE_URL,resolve(process.argv[3]),process.argv[4],key),null,2));
 }else throw new Error('Choose key, backup or restore.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(error=>{
 console.error(error.code?`Recovery failed (${String(error.code).replace(/[^A-Z0-9_]/gi,'')}). Check configuration and PostgreSQL permissions.`:error.message);
 process.exitCode=1;
});
