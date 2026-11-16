const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {Pool}=require('pg');
require('../dist/config.js');
const {migrate}=require('../dist/database/migrate.js');
const {digest,encryptSecret}=require('../dist/auth/crypto.js');

test('books: INR journals, periods, weighted stock, atomic postings, reconciliation, concurrency and retries',async()=>{
 process.env.MFA_ENCRYPTION_KEY='7'.repeat(64);
 const original=process.env.DATABASE_URL,owner=new Pool({connectionString:original}),schema=`erp_test_${randomUUID().replaceAll('-','')}`;
 await owner.query(`CREATE SCHEMA "${schema}"`);const url=new URL(original);url.searchParams.set('options',`-c search_path=${schema}`);process.env.DATABASE_URL=url.toString();
 const pool=new Pool({connectionString:url.toString()});let app;
 try{
  await migrate(pool);await migrate(pool);const people={};
  for(const role of ['admin','accountant','inventory_manager','auditor','reader','purchasing']){const id=randomUUID(),token=randomBytes(32).toString('hex');await pool.query('INSERT INTO erp_users(id,email,password_hash,role,mfa_secret) VALUES($1,$2,$3,$4,$5)',[id,`${role}@books.test`,'test-fixture-not-a-password-hash',role,encryptSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',id)]);await pool.query("INSERT INTO erp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[digest(token),id]);people[role]={id,token};}
  app=await require('../dist/bootstrap.js').createApplication();await app.listen(0,'127.0.0.1');const base=await app.getUrl();
  async function call(path,method='GET',body,role='accountant',key=randomUUID()){const response=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${people[role].token}`,...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
  async function ok(path,method,body,role,key){const result=await call(path,method,body,role,key);assert.ok(result.status===200||result.status===201,`${method||'GET'} ${path}: ${result.status} ${JSON.stringify(result.data)}`);return result.data;}
  const date=(await pool.query('SELECT current_date::text AS date')).rows[0].date,year=date.slice(0,4),start=`${year}-01-01`,end=`${year}-12-31`;
  assert.equal((await call('/books','GET',undefined,'reader')).status,403);
  assert.equal((await call('/books')).data.configured,false);
  const setup={currency:'INR',valuation:'MOVING_AVERAGE',confirmPostingRules:true};
  assert.equal((await call('/books/setup','POST',setup)).status,403);
  assert.equal((await call('/books/setup','POST',{...setup,currency:'USD'},'admin')).status,400);
  const setupKey=randomUUID();const setups=await Promise.all([1,2].map(()=>ok('/books/setup','POST',setup,'admin',setupKey)));assert.deepEqual(setups[0],setups[1]);
  assert.equal((await call('/books/setup','POST',setup,'admin')).status,409);
  const chart=setups[0].accounts,control=name=>chart.find(a=>a.control===name).id;
  const inventoryOverview=await ok('/books','GET',undefined,'inventory_manager');assert.deepEqual(inventoryOverview.accounts,[]);assert.deepEqual(inventoryOverview.periods,[]);
  for(const path of ['/books/journals','/books/bank-reconciliations','/books/trial-balance?date='+date,'/books/history/account/'+control('BANK')])assert.equal((await call(path,'GET',undefined,'inventory_manager')).status,403);
  const period=await ok('/books/periods','POST',{name:'Current year',startsOn:start,endsOn:end});
  assert.equal((await call('/books/periods','POST',{name:'Overlap',startsOn:date,endsOn:end})).status,409);
  assert.equal((await call('/books/periods','POST',{name:'Invalid',startsOn:end,endsOn:start})).status,400);
  let expense=await ok('/books/accounts','POST',{code:'6000',name:'Office expense',type:'EXPENSE'});assert.equal(expense.control,null);
  const update={name:'Office costs',active:true,version:1};const accountRace=await Promise.all([1,2].map(()=>call('/books/accounts/'+expense.id,'PATCH',update)));assert.deepEqual(accountRace.map(r=>r.status).sort(),[200,409]);expense=accountRace.find(r=>r.status===200).data;
  assert.equal((await call('/books/accounts/'+control('INVENTORY'),'PATCH',{name:'Bad',active:false,version:1})).status,409);
  const draftInput={date,description:'Bank capital introduced',lines:[{accountId:control('BANK'),debit:'100',credit:'0'},{accountId:control('OPENING'),debit:'0',credit:'100'}]};
  assert.equal((await call('/books/journals','POST',{...draftInput,lines:[draftInput.lines[0],{...draftInput.lines[1],credit:'99.99'}]})).status,400);
  assert.equal((await call('/books/journals','POST',{...draftInput,lines:[{...draftInput.lines[0],debit:'1.001'},draftInput.lines[1]]})).status,400);
  assert.equal((await call('/books/journals','POST',{...draftInput,lines:[{...draftInput.lines[0],accountId:control('INVENTORY')},draftInput.lines[1]]})).status,403);
  assert.equal((await call('/books/journals','POST',draftInput,'inventory_manager')).status,403);
  assert.equal((await call('/books/journals','POST',draftInput,'accountant',null)).status,400);
  let journal=await ok('/books/journals','POST',draftInput);
  assert.equal((await call('/books/periods/'+period.id+'/state','POST',{version:1,status:'CLOSED',reason:'Period reviewed'})).status,409);
  assert.equal((await call('/books/journals/'+journal.id+'/post','POST',{version:99})).status,409);
  const postKey=randomUUID(),posts=await Promise.all([1,2].map(()=>ok('/books/journals/'+journal.id+'/post','POST',{version:journal.version},'accountant',postKey)));assert.deepEqual(posts[0],posts[1]);journal=posts[0];assert.equal(journal.status,'POSTED');
  assert.equal((await call('/books/journals/'+journal.id,'PATCH',{...draftInput,version:journal.version})).status,409);
  await assert.rejects(()=>pool.query('UPDATE erp_journals SET description=\'tamper\' WHERE id=$1',[journal.id]));
  await assert.rejects(()=>pool.query('DELETE FROM erp_journal_lines WHERE journal_id=$1',[journal.id]));
  // Deferred database constraints also reject a direct unbalanced posting.
  const dbClient=await pool.connect();try{await dbClient.query('BEGIN');const id=randomUUID();await dbClient.query("INSERT INTO erp_journals(id,date,description,status,source,created_by,posted_by,posted_at) VALUES($1,$2,'Invalid direct posting','POSTED','MANUAL',$3,$3,now())",[id,date,people.accountant.id]);await assert.rejects(()=>dbClient.query('COMMIT'));}finally{await dbClient.query('ROLLBACK');dbClient.release();}
  let w1=await ok('/books/warehouses','POST',{code:'MAIN',name:'Main warehouse'},'inventory_manager'),w2=await ok('/books/warehouses','POST',{code:'SECOND',name:'Second warehouse'},'inventory_manager');
  const item=await ok('/procurement/items','POST',{code:'MAT',name:'Material',unit:'EA'},'purchasing');
  const movement=(kind,quantity,extra={})=>({kind,date,reason:'Verified stock evidence',itemId:item.id,warehouseId:w1.id,quantity,unitCost:'0',...extra});
  async function stock(){return ok('/books/valuation?date='+date);}
  async function source(){return (await stock()).rows.find(r=>r.itemId===item.id&&r.warehouseId===w1.id);}
  const moveKey=randomUUID(),opening=movement('OPENING','10',{unitCost:'10'});const opened=await Promise.all([1,2].map(()=>ok('/books/movements','POST',opening,'inventory_manager',moveKey)));assert.deepEqual(opened[0],opened[1]);assert.equal(opened[0].value,'100.00');
  assert.equal((await call('/books/movements','POST',{...opening,quantity:'11'},'inventory_manager',moveKey)).status,409);
  assert.equal((await call('/books/movements','POST',opening,'inventory_manager')).status,409);
  await ok('/books/movements','POST',movement('INCREASE','10',{unitCost:'20'}),'inventory_manager');let row=await source();assert.equal(row.quantity,'20.000000');assert.equal(row.value,'300.00');assert.equal(row.averageCost,'15.000000');
  assert.equal((await call('/procurement/items/'+item.id,'PATCH',{name:item.name,unit:'KG',description:'',active:true,version:item.version},'purchasing')).status,409);
  assert.equal((await call('/procurement/items/'+item.id,'PATCH',{name:item.name,unit:'EA',description:'',active:false,version:item.version},'purchasing')).status,409);
  assert.equal((await call('/books/warehouses/'+w1.id,'PATCH',{name:w1.name,active:false,version:w1.version},'inventory_manager')).status,409);
  assert.equal((await call('/books/movements','POST',movement('DECREASE','21',{version:row.version}),'inventory_manager')).status,409);
  assert.equal((await call('/books/movements','POST',movement('DECREASE','1'),'inventory_manager')).status,400);
  const races=await Promise.all([1,2].map(()=>call('/books/movements','POST',movement('DECREASE','3',{version:row.version}),'inventory_manager')));assert.deepEqual(races.map(r=>r.status).sort(),[201,409]);assert.equal(races.find(r=>r.status===201).data.value,'45.00');
  row=await source();const transfer=await ok('/books/movements','POST',movement('TRANSFER','2',{version:row.version,destinationId:w2.id}),'inventory_manager');assert.equal(transfer.value,'30.00');
  const destination=(await stock()).rows.find(r=>r.warehouseId===w2.id);await ok('/books/movements','POST',movement('CONSUME','1',{warehouseId:w2.id,version:destination.version}),'inventory_manager');
  row=await source();assert.equal((await call('/books/movements','POST',movement('COUNT','14',{version:row.version-1}),'inventory_manager')).status,409);
  await ok('/books/movements','POST',movement('COUNT','14',{version:row.version}),'inventory_manager');row=await source();await ok('/books/movements','POST',movement('COUNT','15',{version:row.version,unitCost:'20'}),'inventory_manager');
  let reconciled=await stock();assert.equal(reconciled.stockValue,'245.00');assert.equal(reconciled.ledgerValue,'245.00');assert.equal(reconciled.balanced,true);
  assert.equal((await call('/books/movements','POST',movement('INCREASE','1',{date:`${Number(year)-1}-12-31`,unitCost:'10'}),'inventory_manager')).status,409);
  // Concurrent retries consume stock and post to the GL once, including exact paise rounding.
  const tiny=await ok('/procurement/items','POST',{code:'TINY',name:'Rounding sample',unit:'EA'},'purchasing');
  await ok('/books/movements','POST',movement('OPENING','3',{itemId:tiny.id,unitCost:'0.003333'}),'inventory_manager');let tinyRow=(await stock()).rows.find(r=>r.itemId===tiny.id);
  const zero=await ok('/books/movements','POST',movement('DECREASE','1',{itemId:tiny.id,version:tinyRow.version}),'inventory_manager');assert.equal(zero.value,'0.00');assert.equal(zero.journalId,null);
  tinyRow=(await stock()).rows.find(r=>r.itemId===tiny.id);const all=await ok('/books/movements','POST',movement('DECREASE','2',{itemId:tiny.id,version:tinyRow.version}),'inventory_manager');assert.equal(all.value,'0.01');assert.equal((await stock()).balanced,true);
  await assert.rejects(()=>pool.query('UPDATE erp_stock_movements SET reason=\'tamper\''));await assert.rejects(()=>pool.query('DELETE FROM erp_stock_entries'));
  // Fail after the stock GL posting; the journal, movement, projection, audit and retry must all roll back.
  await pool.query(`CREATE FUNCTION reject_test_stock_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='stock_movement' AND NEW.snapshot->>'reason'='ROLLBACK' THEN RAISE EXCEPTION 'forced history failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fail_test_stock_history BEFORE INSERT ON erp_record_history FOR EACH ROW EXECUTE FUNCTION reject_test_stock_history()`);
  const beforeFailure=await stock(),journalCount=(await pool.query('SELECT count(*) FROM erp_journals')).rows[0].count,failedKey=randomUUID();
  assert.equal((await call('/books/movements','POST',movement('INCREASE','1',{reason:'ROLLBACK',unitCost:'10'}),'inventory_manager',failedKey)).status,500);
  assert.deepEqual(await stock(),beforeFailure);assert.equal((await pool.query('SELECT count(*) FROM erp_journals')).rows[0].count,journalCount);assert.equal((await pool.query('SELECT count(*) FROM erp_operations WHERE request_id=$1',[failedKey])).rows[0].count,'0');
  // Deliberate projection corruption is detected even when aggregate GL still agrees.
  await pool.query('UPDATE erp_stock_balances SET value=value+1 WHERE item_id=$1 AND warehouse_id=$2',[item.id,w1.id]);assert.equal((await stock()).balanced,false);
  assert.equal((await call('/books/movements','POST',movement('INCREASE','1',{unitCost:'10'}),'inventory_manager')).status,409);
  assert.equal((await call('/books/periods/'+period.id+'/state','POST',{version:1,status:'CLOSED',reason:'Must not close differences'})).status,409);
  await pool.query('UPDATE erp_stock_balances SET value=value-1 WHERE item_id=$1 AND warehouse_id=$2',[item.id,w1.id]);assert.equal((await stock()).balanced,true);
  const projection=(await pool.query('DELETE FROM erp_stock_balances WHERE item_id=$1 AND warehouse_id=$2 RETURNING *',[item.id,w1.id])).rows[0];assert.equal((await stock()).balanced,false);assert.equal((await stock()).stockValue,'245.00');
  await pool.query('INSERT INTO erp_stock_balances(item_id,warehouse_id,quantity,value,version) VALUES($1,$2,$3,$4,$5)',[projection.item_id,projection.warehouse_id,projection.quantity,projection.value,projection.version]);assert.equal((await stock()).balanced,true);
  const trial=await ok('/books/trial-balance?date='+date);assert.equal(trial.balanced,true);assert.equal(trial.debit,trial.credit);
  let bank=await ok('/books/bank-reconciliations','POST',{accountId:control('BANK'),startsOn:date,endsOn:date,opening:'0',closing:'100',lines:[{date,reference:'Capital',amount:'100'}]});
  bank=await ok('/books/bank-reconciliations/'+bank.id,'PATCH',{accountId:control('BANK'),startsOn:date,endsOn:date,opening:'0',closing:'100',lines:[{date,reference:'Corrected capital',amount:'100'}],version:bank.version});
  assert.equal(bank.ready,false);assert.equal((await call('/books/bank-reconciliations/'+bank.id+'/finalise','POST',{version:1})).status,409);
  assert.equal((await call('/books/bank-reconciliations/'+bank.id+'/match','POST',{version:bank.version,statementLineId:bank.lines[0].id,journalLineId:journal.lines.find(l=>l.credit!=='0.00').id})).status,400);
  bank=await ok('/books/bank-reconciliations/'+bank.id+'/match','POST',{version:bank.version,statementLineId:bank.lines[0].id,journalLineId:journal.lines.find(l=>l.accountId===control('BANK')).id});assert.equal(bank.ready,true);
  bank=await ok('/books/bank-reconciliations/'+bank.id+'/finalise','POST',{version:bank.version});assert.equal(bank.status,'FINALISED');
  await assert.rejects(()=>pool.query("UPDATE erp_bank_statement_lines SET reference='tamper' WHERE reconciliation_id=$1",[bank.id]));
  assert.equal((await call('/books/journals/'+journal.id+'/reverse','POST',{version:journal.version,date,reason:'Must respect bank cutoff'})).status,409);
  // A separate non-bank manual journal can be reversed, only once.
  let adjustable=await ok('/books/journals','POST',{date,description:'Expense allocation',lines:[{accountId:expense.id,debit:'0.1',credit:'0'},{accountId:control('OPENING'),debit:'0',credit:'0.10'}]});adjustable=await ok('/books/journals/'+adjustable.id+'/post','POST',{version:adjustable.version});
  const reversalKey=randomUUID(),reversalInput={version:adjustable.version,date,reason:'Allocation correction'},reversals=await Promise.all([1,2].map(()=>ok('/books/journals/'+adjustable.id+'/reverse','POST',reversalInput,'accountant',reversalKey)));assert.deepEqual(reversals[0],reversals[1]);assert.equal(reversals[0].reversedOf,adjustable.id);
  assert.equal((await call('/books/journals/'+adjustable.id+'/reverse','POST',reversalInput)).status,409);
  let closed=await ok('/books/periods/'+period.id+'/state','POST',{version:period.version,status:'CLOSED',reason:'Reconciled and reviewed'});assert.equal(closed.status,'CLOSED');
  const closedAttempt=movement('INCREASE','1',{unitCost:'1'});assert.equal((await call('/books/movements','POST',closedAttempt,'inventory_manager')).status,409);
  const pending=await ok('/books/journals','POST',{date,description:'Closed period draft',lines:[{accountId:expense.id,debit:'1',credit:'0'},{accountId:control('OPENING'),debit:'0',credit:'1'}]});assert.equal((await call('/books/journals/'+pending.id+'/post','POST',{version:1})).status,409);
  const reopen=await ok('/books/periods/'+period.id+'/state','POST',{version:closed.version,status:'OPEN',reason:'Authorised adjustment window'});assert.equal(reopen.status,'OPEN');await ok('/books/journals/'+pending.id+'/post','POST',{version:1});
  const history=await ok('/books/history/stock_movement/'+opened[0].id);assert.equal(history.length,1);assert.equal(history[0].action,'posted');assert.equal((await call('/books','GET',undefined,'auditor')).status,200);assert.equal((await call('/books/accounts','POST',{code:'X',name:'Denied',type:'ASSET'},'auditor')).status,403);
  assert.ok((await pool.query("SELECT 1 FROM erp_audit_events WHERE action='stock_movement.posted'")).rowCount);
 }finally{if(app)await app.close();await pool.end();process.env.DATABASE_URL=original;await owner.query(`DROP SCHEMA "${schema}" CASCADE`);await owner.end();}
});
