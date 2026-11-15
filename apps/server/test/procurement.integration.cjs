const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { Pool } = require('pg');
require('../dist/config.js');
const { migrate } = require('../dist/database/migrate.js');
const { digest, encryptSecret } = require('../dist/auth/crypto.js');

test('procurement: validated masters, scoped requests, independent decisions, exact values, history, concurrency and retries', async () => {
  process.env.MFA_ENCRYPTION_KEY='6'.repeat(64);
  const originalUrl=process.env.DATABASE_URL, owner=new Pool({connectionString:originalUrl});
  const schema=`erp_test_${randomUUID().replaceAll('-','')}`;
  await owner.query(`CREATE SCHEMA "${schema}"`);
  const url=new URL(originalUrl);url.searchParams.set('options',`-c search_path=${schema}`);process.env.DATABASE_URL=url.toString();
  const pool=new Pool({connectionString:url.toString()});let app;
  try {
    await migrate(pool);await migrate(pool);
    const people={};
    for(const [name,role] of Object.entries({admin:'admin',buyer:'purchasing',requester:'requester',other:'requester',approver:'business_approver',second:'business_approver',auditor:'auditor',reader:'reader'})) {
      const id=randomUUID(),token=randomBytes(32).toString('hex');
      await pool.query('INSERT INTO erp_users(id,email,password_hash,role,mfa_secret) VALUES($1,$2,$3,$4,$5)',[id,`${name}@test.example`,'test-fixture-not-a-password-hash',role,encryptSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',id)]);
      await pool.query("INSERT INTO erp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[digest(token),id]);people[name]={id,token};
    }
    app=await require('../dist/bootstrap.js').createApplication();await app.listen(0,'127.0.0.1');const base=await app.getUrl();
    async function call(path,method='GET',body,actor='requester',key=randomUUID()) {
      const response=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${people[actor].token}`,...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
      return {status:response.status,data:await response.json()};
    }
    const supplierInput={code:'sup-1',name:'Example supplier',contactEmail:'contact@example.test',phone:'+44 1234',paymentTermsDays:30,active:true};
    const itemInput={code:'item-1',name:'Example item',description:'Stock item',unit:'ea',active:true};
    const supplierKey=randomUUID();
    const suppliers=await Promise.all([1,2].map(()=>call('/procurement/suppliers','POST',supplierInput,'buyer',supplierKey)));
    assert.deepEqual(suppliers.map(result=>result.status),[201,201]);assert.deepEqual(suppliers[0].data,suppliers[1].data);
    let supplier=suppliers[0].data;assert.equal(supplier.code,'SUP-1');
    assert.equal((await call('/procurement/suppliers','POST',{...supplierInput,name:'Different'},'buyer',supplierKey)).status,409);
    assert.equal((await call('/procurement/items','POST',itemInput,'buyer',supplierKey)).status,409);
    assert.equal((await call('/procurement/suppliers','POST',supplierInput,'buyer')).status,409);
    assert.equal((await call('/procurement/suppliers','POST',supplierInput,'buyer',null)).status,400);
    assert.equal((await call('/procurement/suppliers','POST',{...supplierInput,code:'NEW',contactEmail:'bad'},'buyer')).status,400);
    assert.equal((await call('/procurement/suppliers','POST',{...supplierInput,code:'NEW',active:true,bankAccount:'unapproved'},'buyer')).status,400);
    assert.equal((await call('/procurement/suppliers','POST',supplierInput,'requester')).status,403);
    const publicSupplier=(await call('/procurement/suppliers')).data.items[0];assert.equal(publicSupplier.contactEmail,undefined);assert.equal(publicSupplier.phone,undefined);
    assert.equal((await call('/procurement/history/supplier/'+supplier.id)).status,403);
    assert.equal((await call('/procurement/suppliers','GET',undefined,'reader')).status,403);
    const createdItem=await call('/procurement/items','POST',itemInput,'buyer');assert.equal(createdItem.status,201);let item=createdItem.data;
    const {code:unused,...supplierFields}=supplierInput;
    const race=await Promise.all(['Renamed A','Renamed B'].map(name=>call('/procurement/suppliers/'+supplier.id,'PATCH',{...supplierFields,name,version:1},'buyer')));
    assert.deepEqual(race.map(result=>result.status).sort(),[200,409]);supplier=race.find(result=>result.status===200).data;
    assert.equal((await call('/procurement/suppliers/'+supplier.id,'PATCH',{...supplierFields,code:'CHANGED',version:2},'buyer')).status,400);
    const input={title:'Workshop materials',justification:'Materials for the workshop\nReviewed requirements',currency:'eur',supplierId:supplier.id,neededBy:'2027-01-01',lines:[{itemId:item.id,quantity:'0.1',estimatedUnitPrice:'0.2'}]};
    for(const lines of [[],[{...input.lines[0],quantity:'0'}],[{...input.lines[0],quantity:'-1'}],[{...input.lines[0],quantity:1}],[{...input.lines[0],estimatedUnitPrice:'1.00001'}],[input.lines[0],input.lines[0]]]) assert.equal((await call('/procurement/requests','POST',{...input,lines})).status,400);
    assert.equal((await call('/procurement/requests','POST',{...input,requesterId:people.approver.id})).status,400);
    const requestKey=randomUUID(), drafts=await Promise.all([1,2].map(()=>call('/procurement/requests','POST',input,'requester',requestKey)));
    assert.deepEqual(drafts.map(result=>result.status),[201,201]);assert.deepEqual(drafts[0].data,drafts[1].data);let record=drafts[0].data;
    assert.equal(record.estimatedTotal,'0.0200000000');assert.equal(record.requesterId,people.requester.id);assert.equal(record.currency,'EUR');
    assert.equal((await call('/procurement/requests/'+record.id,'GET',undefined,'other')).status,404);
    assert.equal((await call('/procurement/requests','GET',undefined,'other')).data.total,0);
    assert.equal((await call('/procurement/requests/'+record.id,'GET',undefined,'auditor')).status,200);
    assert.equal((await call('/procurement/requests','POST',input,'auditor')).status,403);
    let updated=await call('/procurement/requests/'+record.id,'PATCH',{...input,version:record.version,title:'Revised workshop materials'});assert.equal(updated.status,200);record=updated.data;
    assert.equal((await call('/procurement/requests/'+record.id,'PATCH',{...input,version:1})).status,409);
    const submitInput={version:record.version,approverId:people.approver.id},submitKey=randomUUID();
    const submits=await Promise.all([1,2].map(()=>call('/procurement/requests/'+record.id+'/submit','POST',submitInput,'requester',submitKey)));
    assert.deepEqual(submits.map(result=>result.status),[201,201]);assert.deepEqual(submits[0].data,submits[1].data);record=submits[0].data;
    assert.equal(record.status,'SUBMITTED');
    assert.equal((await call('/procurement/requests/'+record.id,'PATCH',{...input,version:record.version})).status,409);
    assert.equal((await call('/procurement/requests/'+record.id+'/decide','POST',{version:record.version,decision:'APPROVED'},'requester')).status,403);
    assert.equal((await call('/procurement/requests/'+record.id+'/decide','POST',{version:record.version,decision:'APPROVED'},'second')).status,404);
    assert.equal((await call('/procurement/requests/'+record.id+'/decide','POST',{version:record.version,decision:'REJECTED',reason:''},'approver')).status,400);
    const decisions=await Promise.all(['APPROVED','REJECTED'].map(decision=>call('/procurement/requests/'+record.id+'/decide','POST',{version:record.version,decision,reason:'Review complete'},'approver')));
    assert.deepEqual(decisions.map(result=>result.status).sort(),[201,409]);record=decisions.find(result=>result.status===201).data;
    // Use a separate rejection flow so both decisions are always exercised regardless of the race winner.
    let rejected=(await call('/procurement/requests','POST',{...input,title:'Request needing revision'})).data;
    rejected=(await call('/procurement/requests/'+rejected.id+'/submit','POST',{version:rejected.version,approverId:people.approver.id})).data;
    const rejectKey=randomUUID(), rejection=await call('/procurement/requests/'+rejected.id+'/decide','POST',{version:rejected.version,decision:'REJECTED',reason:'Reduce requested amount'},'approver',rejectKey);assert.equal(rejection.status,201);rejected=rejection.data;
    assert.deepEqual((await call('/procurement/requests/'+rejected.id+'/decide','POST',{version:2,decision:'REJECTED',reason:'Reduce requested amount'},'approver',rejectKey)).data,rejected);
    rejected=(await call('/procurement/requests/'+rejected.id,'PATCH',{...input,version:rejected.version,title:'Reduced request'})).data;assert.equal(rejected.status,'DRAFT');assert.equal(rejected.approverId,null);
    rejected=(await call('/procurement/requests/'+rejected.id+'/submit','POST',{version:rejected.version,approverId:people.approver.id})).data;
    const approveKey=randomUUID(),approveBody={version:rejected.version,decision:'APPROVED',reason:'Revised amount accepted'};
    const approved=await Promise.all([1,2].map(()=>call('/procurement/requests/'+rejected.id+'/decide','POST',approveBody,'approver',approveKey)));
    assert.deepEqual(approved.map(result=>result.status),[201,201]);assert.deepEqual(approved[0].data,approved[1].data);
    const history=await call('/procurement/history/purchase_request/'+rejected.id);assert.equal(history.status,200);
    assert.deepEqual(history.data.map(event=>event.action),['approved','submitted','revised','rejected','submitted','created']);
    assert.equal(history.data.find(event=>event.action==='rejected').snapshot.decisionReason,'Reduce requested amount');
    assert.equal((await call('/procurement/history/purchase_request/'+rejected.id,'GET',undefined,'other')).status,404);
    // Approvers may request purchases themselves but may never submit to or decide for themselves.
    const own=(await call('/procurement/requests','POST',input,'approver')).data;
    assert.equal((await call('/procurement/requests/'+own.id+'/submit','POST',{version:own.version,approverId:people.approver.id},'approver')).status,403);
    assert.equal((await call('/procurement/requests/'+own.id+'/decide','POST',{version:own.version,decision:'APPROVED'},'approver')).status,403);
    // Master version changes force a deliberate draft refresh; submitted snapshots remain intact.
    let stale=(await call('/procurement/requests','POST',input)).data;
    const {code:itemCode,...itemFields}=itemInput;
    item=(await call('/procurement/items/'+item.id,'PATCH',{...itemFields,name:'Updated master name',unit:'EA',version:item.version},'buyer')).data;
    assert.equal((await call('/procurement/requests/'+stale.id+'/submit','POST',{version:stale.version,approverId:people.approver.id})).status,409);
    assert.equal((await call('/procurement/requests/'+stale.id)).data.lines[0].itemName,'Example item');
    stale=(await call('/procurement/requests/'+stale.id,'PATCH',{...input,version:stale.version})).data;
    stale=(await call('/procurement/requests/'+stale.id+'/submit','POST',{version:stale.version,approverId:people.approver.id})).data;
    item=(await call('/procurement/items/'+item.id,'PATCH',{...itemFields,unit:'EA',active:false,version:item.version},'buyer')).data;
    assert.equal((await call('/procurement/requests','POST',input)).status,409);
    assert.equal((await call('/procurement/requests/'+stale.id+'/decide','POST',{version:stale.version,decision:'APPROVED'},'approver')).status,409);
    assert.equal((await call('/procurement/requests/'+stale.id+'/decide','POST',{version:stale.version,decision:'REJECTED',reason:'Item no longer active'},'approver')).status,201);
    await assert.rejects(()=>pool.query('UPDATE erp_record_history SET action=\'tampered\''));
    // A history failure must roll back header, lines, audit and retry response.
    await pool.query(`CREATE FUNCTION reject_test_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.snapshot->>'title'='ROLLBACK' THEN RAISE EXCEPTION 'forced history failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fail_test_history BEFORE INSERT ON erp_record_history FOR EACH ROW EXECUTE FUNCTION reject_test_history()`);
    item=(await call('/procurement/items/'+item.id,'PATCH',{...itemFields,unit:'EA',version:item.version},'buyer')).data;
    const failedKey=randomUUID();assert.equal((await call('/procurement/requests','POST',{...input,title:'ROLLBACK'},'requester',failedKey)).status,500);
    assert.equal((await pool.query("SELECT count(*) FROM erp_purchase_requests WHERE title='ROLLBACK'")).rows[0].count,'0');
    assert.equal((await pool.query('SELECT count(*) FROM erp_operations WHERE request_id=$1',[failedKey])).rows[0].count,'0');
    assert.equal((await pool.query('SELECT count(*) FROM erp_record_history WHERE entity_type=\'supplier\' AND entity_id=$1',[supplier.id])).rows[0].count,'2');
    assert.ok((await pool.query("SELECT 1 FROM erp_audit_events WHERE action='purchase_request.approved'")).rowCount);
  } finally {if(app)await app.close();await pool.end();process.env.DATABASE_URL=originalUrl;await owner.query(`DROP SCHEMA "${schema}" CASCADE`);await owner.end();}
});
