import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,randomBytes,createHash,createHmac} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createBackup,restoreBackup} from './recovery.mjs';
const require=createRequire(import.meta.url);require('../apps/server/dist/config.js');
const {Pool}=require('pg'),{migrate}=require('../apps/server/dist/database/migrate.js');
const configured=process.env.DATABASE_URL,owner=new Pool({connectionString:configured}),suffix=randomUUID().replaceAll('-',''),source=`erp_test_${suffix}`,target=`erp_restore_${suffix}`,key=randomBytes(32);
let pool,restored,created=false;
mkdirSync(new URL('../.local/recovery/',import.meta.url),{recursive:true});const file=fileURLToPath(new URL(`../.local/recovery/${suffix}.erpbak`,import.meta.url));
try {
 await owner.query(`CREATE DATABASE "${source}"`);created=true;const url=new URL(configured);url.pathname='/'+source;pool=new Pool({connectionString:url.toString()});await migrate(pool);
 const user=randomUUID();await pool.query("INSERT INTO erp_users(id,email,password_hash,role) VALUES($1,'synthetic@recovery.invalid','fixture','admin')",[user]);await pool.query("INSERT INTO erp_sessions(token_hash,user_id,expires_at) VALUES('synthetic-hash',$1,now()+interval '1 hour')",[user]);await pool.query("INSERT INTO erp_customers(code,name) VALUES('RECOVERY','Synthetic confidential recovery record')");
 const bank=randomUUID(),equity=randomUUID(),journal=randomUUID();
 await pool.query("INSERT INTO erp_books(currency,valuation,created_by) VALUES('INR','MOVING_AVERAGE',$1)",[user]);
 await pool.query("INSERT INTO erp_accounts(id,code,name,type,control) VALUES($1,'1110','Bank','ASSET','BANK'),($2,'3100','Equity','EQUITY','OPENING')",[bank,equity]);
 await pool.query("INSERT INTO erp_periods(id,name,starts_on,ends_on) VALUES($1,'Recovery fixture',current_date,current_date)",[randomUUID()]);
 const c=await pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO erp_journals(id,date,description,source,created_by,cash_flow_category) VALUES($1,current_date,'Synthetic capital','MANUAL',$2,'FINANCING')",[journal,user]);await c.query('INSERT INTO erp_journal_lines(id,journal_id,line_no,account_id,debit,credit) VALUES($1,$2,1,$3,100,0),($4,$2,2,$5,0,100)',[randomUUID(),journal,bank,randomUUID(),equity]);await c.query("UPDATE erp_journals SET status='POSTED',posted_by=$2,posted_at=now() WHERE id=$1",[journal,user]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 await createBackup(url.toString(),file,key);assert.equal(readFileSync(file).includes(Buffer.from('Synthetic confidential recovery record')),false);
 await assert.rejects(()=>restoreBackup(url.toString(),file,target,randomBytes(32)),/authentication/);
 const corrupt=file+'.corrupt';const bytes=readFileSync(file);bytes[Math.floor(bytes.length/2)]^=1;writeFileSync(corrupt,bytes);copyFileSync(file+'.json',corrupt+'.json');await assert.rejects(()=>restoreBackup(url.toString(),corrupt,target,key),/hash mismatch/);assert.equal((await owner.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rowCount,0);
 // Even with a newly authenticated manifest, corrupted encrypted payload must fail its GCM tag.
 const {mac,...body}=JSON.parse(readFileSync(file+'.json','utf8'));body.sha256=createHash('sha256').update(bytes).digest('hex');const changed={...body,mac:createHmac('sha256',key).update(JSON.stringify(body)).digest('hex')};writeFileSync(corrupt+'.json',JSON.stringify(changed));await assert.rejects(()=>restoreBackup(url.toString(),corrupt,target,key));assert.equal((await owner.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rowCount,0);
 const result=await restoreBackup(url.toString(),file,target,key);assert.equal(result.verified,true);
 const targetUrl=new URL(configured);targetUrl.pathname='/'+target;restored=new Pool({connectionString:targetUrl.toString()});assert.equal((await restored.query('SELECT name FROM erp_customers')).rows[0].name,'Synthetic confidential recovery record');assert.equal((await restored.query('SELECT count(*) FROM erp_sessions')).rows[0].count,'0');assert.equal((await pool.query('SELECT count(*) FROM erp_sessions')).rows[0].count,'1');
 assert.equal((await restored.query('SELECT status FROM erp_journals WHERE id=$1',[journal])).rows[0].status,'POSTED');assert.equal((await restored.query('SELECT sum(debit)::text AS debit FROM erp_journal_lines')).rows[0].debit,'100.00');await assert.rejects(()=>restored.query("UPDATE erp_journals SET description='tampered' WHERE id=$1",[journal]));
 await assert.rejects(()=>restoreBackup(url.toString(),file,target,key),/already exists/);
 await assert.rejects(()=>restoreBackup(url.toString(),file,source,key),/Restore target/);
 console.log('Recovery passed: encrypted snapshot, wrong-key and corruption rejection, new-target-only restore, row counts, schema checks, financial controls and restored-session revocation. Configured database was not changed.');
}finally{await restored?.end();await pool?.end();if((await owner.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rowCount)await owner.query(`DROP DATABASE "${target}" WITH (FORCE)`);if(created)await owner.query(`DROP DATABASE "${source}" WITH (FORCE)`);await owner.end();}
