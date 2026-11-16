import {createRequire} from 'node:module';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);require('../apps/server/dist/config.js');
const {Pool}=require('pg'),{migrate}=require('../apps/server/dist/database/migrate.js'),{digest,encryptSecret}=require('../apps/server/dist/auth/crypto.js');
const count=Number(process.env.LOAD_REQUESTS||200),concurrency=Number(process.env.LOAD_CONCURRENCY||8),budget=Number(process.env.LOAD_P95_MS||2000);
if(!Number.isInteger(count)||count<20||count>5000||!Number.isInteger(concurrency)||concurrency<1||concurrency>32||!Number.isFinite(budget)||budget<1)throw new Error('Use LOAD_REQUESTS=20..5000, LOAD_CONCURRENCY=1..32 and a positive LOAD_P95_MS.');
const original=process.env.DATABASE_URL,name=`erp_test_${randomUUID().replaceAll('-','')}`,owner=new Pool({connectionString:original,connectionTimeoutMillis:5000});
let pool,app,created=false;
try {
 await owner.query(`CREATE DATABASE "${name}"`);created=true;const url=new URL(original);url.pathname='/'+name;process.env.DATABASE_URL=url.toString();
 process.env.MFA_ENCRYPTION_KEY=randomBytes(32).toString('hex');process.env.ADMIN_SETUP_TOKEN=randomBytes(32).toString('hex');
 pool=new Pool({connectionString:url.toString()});await migrate(pool);
 await pool.query("INSERT INTO erp_customers(code,name) SELECT 'SEED-'||n,'Synthetic customer '||n FROM generate_series(1,100) n");
 const tokens=[];
 for(let i=0;i<concurrency;i++){
  const id=randomUUID(),token=randomBytes(32).toString('hex');tokens.push(token);
  await pool.query("INSERT INTO erp_users(id,email,password_hash,role,mfa_secret) VALUES($1,$2,'load-fixture','admin',$3)",[id,`worker${i}@load.invalid`,encryptSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',id)]);
  await pool.query("INSERT INTO erp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[digest(token),id]);
 }
 app=await require('../apps/server/dist/bootstrap.js').createApplication();await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 const latencies=[],failures=[];let next=0,completed=0,writes=0;const started=performance.now();
 async function request(token,path,method='GET',body,key){const t=performance.now();try{const r=await fetch(base+'/api/v1'+path,{method,signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});await r.arrayBuffer();latencies.push(performance.now()-t);completed++;if(!r.ok)failures.push(r.status);}catch{failures.push('network');latencies.push(performance.now()-t);}}
 await Promise.all(tokens.map(async token=>{while(next<count){const n=next++;if(n%5===0){const key=randomUUID(),body={code:`LOAD-${n}`,name:`Synthetic load ${n}`};writes++;await request(token,'/customers','POST',body,key);await request(token,'/customers','POST',body,key);}else await request(token,`/customers?page=${n%5+1}`);}}));
 const elapsed=(performance.now()-started)/1000;latencies.sort((a,b)=>a-b);const pct=n=>Math.round(latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*n)-1)]);
 const actual=Number((await pool.query('SELECT count(*) FROM erp_customers')).rows[0].count),uniqueWrites=actual===100+writes;
 const report={generatedAt:new Date().toISOString(),scope:'Disposable local database; synthetic customer reads, creates and exact retries. Not a production sizing result.',concurrency,operations:count,httpRequests:latencies.length,completed,seconds:+elapsed.toFixed(2),requestsPerSecond:+(latencies.length/elapsed).toFixed(2),p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),failures:failures.length,statuses:[...new Set(failures)],retryProtectionPassed:uniqueWrites,p95BudgetMs:budget,passed:!failures.length&&uniqueWrites&&pct(.95)<=budget};
 mkdirSync(new URL('../.local/',import.meta.url),{recursive:true});writeFileSync(new URL('../.local/load-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}catch(e){console.error(`Load test failed${e.code?' ('+e.code+')':''}. Check PostgreSQL and CREATE DATABASE permission.`);process.exitCode=1;}finally{await app?.close();await pool?.end();if(created)await owner.query(`DROP DATABASE "${name}" WITH (FORCE)`);await owner.end();process.env.DATABASE_URL=original;}
