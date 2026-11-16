import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('../apps/server/dist/config.js');
const {Pool}=require('pg'),pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
const apply=process.argv.includes('--apply');
const rules=[
 ['sessions',"DELETE FROM erp_sessions WHERE expires_at<now() OR last_seen_at<now()-interval '30 minutes'"],
 ['challenges','DELETE FROM erp_auth_challenges WHERE expires_at<now()'],
 ['attempts',"DELETE FROM erp_login_attempts WHERE window_started<now()-interval '24 hours'"],
 ['previews','DELETE FROM erp_import_batches WHERE expires_at<now() AND committed_at IS NULL'],
 ['previewRetries',"DELETE FROM erp_operations WHERE operation='import.preview' AND created_at<now()-interval '30 minutes'"]
];
try {
 const c=await pool.connect();
 try {
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");const removed={};
  for(const [kind,sql] of rules) removed[kind]=(await c.query(sql)).rowCount;
  if(apply) await c.query("INSERT INTO erp_audit_events(actor_id,action,entity_type,entity_id,changes) VALUES(NULL,'maintenance.cleaned','maintenance','expired-transient-data',$1)",[JSON.stringify(removed)]);
  await c.query(apply?'COMMIT':'ROLLBACK');console.log(JSON.stringify({dryRun:!apply,removed},null,2));
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}catch(e){console.error(`Maintenance failed${e.code?' ('+String(e.code).replace(/[^A-Z0-9_]/gi,'')+')':''}. Check database access and schema version.`);process.exitCode=1;}finally{await pool.end();}
