const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
require('../dist/config.js');
const { migrate, migrations } = require('../dist/database/migrate.js');

test('schema 9 quotations survive schema 10 and 11 upgrades', async () => {
  const original=process.env.DATABASE_URL, owner=new Pool({connectionString:original});
  const schema=`erp_test_${randomUUID().replaceAll('-','')}`;
  await owner.query(`CREATE SCHEMA "${schema}"`);
  const url=new URL(original);url.searchParams.set('options',`-c search_path=${schema}`);
  const pool=new Pool({connectionString:url.toString()});
  const exceptionOwnership=migrations.pop(),qualification=migrations.pop(),service=migrations.pop(),award=migrations.pop(),policy=migrations.pop(),recommendation=migrations.pop(),last=migrations.pop();
  try {
    assert.equal(last.version,10);assert.equal(recommendation.version,11);assert.equal(policy.version,12);assert.equal(award.version,13);assert.equal(service.version,14);assert.equal(qualification.version,15);assert.equal(exceptionOwnership.version,16);
    await migrate(pool);
    const [user,approver,supplier,item,request,line,quote]=Array.from({length:7},()=>randomUUID());
    await pool.query("INSERT INTO erp_users(id,email,password_hash,role) VALUES($1,'upgrade@test.invalid','fixture','purchasing')",[user]);
    await pool.query("INSERT INTO erp_users(id,email,password_hash,role) VALUES($1,'approver@test.invalid','fixture','business_approver')",[approver]);
    await pool.query("INSERT INTO erp_suppliers(id,code,name,created_by,updated_by) VALUES($1,'SUP','Supplier',$2,$2)",[supplier,user]);
    await pool.query("INSERT INTO erp_items(id,code,name,unit,created_by,updated_by) VALUES($1,'ITEM','Item','EA',$2,$2)",[item,user]);
    await pool.query("INSERT INTO erp_purchase_requests(id,title,justification,currency,requester_id,approver_id,status,submitted_at,decided_at,decision_reason) VALUES($1,'Request','Test request','INR',$2,$3,'APPROVED',now(),now(),'Accepted')",[request,user,approver]);
    await pool.query("INSERT INTO erp_purchase_request_lines(id,request_id,line_no,item_id,item_code,item_name,item_version,unit,quantity,estimated_unit_price) VALUES($1,$2,1,$3,'ITEM','Item',1,'EA',2,5)",[line,request,item]);
    await pool.query("INSERT INTO erp_supplier_quotes(id,request_id,request_version,supplier_id,supplier_code,supplier_name,reference,currency,created_by) VALUES($1,$2,1,$3,'SUP','Supplier','Q-1','INR',$4)",[quote,request,supplier,user]);
    await pool.query("INSERT INTO erp_supplier_quote_lines(quote_id,request_line_id,item_code,item_name,unit,quantity,unit_price) VALUES($1,$2,'ITEM','Item','EA',2,4.5)",[quote,line]);
    migrations.push(last);
    await migrate(pool);
    const saved=await pool.query('SELECT q.reference,l.quantity::text,l.unit_price::text FROM erp_supplier_quotes q JOIN erp_supplier_quote_lines l ON l.quote_id=q.id WHERE q.id=$1',[quote]);
    assert.equal(saved.rows[0].reference,'Q-1');assert.equal(Number(saved.rows[0].quantity),2);assert.equal(Number(saved.rows[0].unit_price),4.5);
    assert.equal((await pool.query('SELECT count(*) FROM erp_supplier_quote_withdrawals')).rows[0].count,'0');
    await pool.query("INSERT INTO erp_supplier_quote_withdrawals(quote_id,reason,withdrawn_by) VALUES($1,'Outdated quote',$2)",[quote,user]);
    migrations.push(recommendation);await migrate(pool);await migrate(pool);
    assert.equal((await pool.query('SELECT count(*) FROM erp_supplier_quote_withdrawals WHERE quote_id=$1',[quote])).rows[0].count,'1');
    assert.equal((await pool.query('SELECT count(*) FROM erp_supplier_quotes WHERE id=$1',[quote])).rows[0].count,'1');
    assert.equal((await pool.query('SELECT count(*) FROM erp_quote_recommendations')).rows[0].count,'0');
    migrations.push(policy);await migrate(pool);assert.equal((await pool.query('SELECT price_tolerance_bps FROM erp_matching_policy')).rows[0].price_tolerance_bps,0);
    const legacyOrder=randomUUID();await pool.query("INSERT INTO erp_purchase_orders(id,request_id,supplier_id,supplier_code,supplier_name,date,description,created_by) VALUES($1,$2,$3,'SUP','Supplier',current_date,'Legacy order',$4)",[legacyOrder,request,supplier,user]);
    migrations.push(award);await migrate(pool);assert.equal((await pool.query('SELECT quote_id FROM erp_purchase_orders WHERE id=$1',[legacyOrder])).rows[0].quote_id,null);
    await pool.query("INSERT INTO erp_order_lines(id,order_id,line_no,item_id,item_code,item_name,unit,quantity,unit_price) VALUES($1,$2,1,$3,'ITEM','Item','EA',2,5)",[randomUUID(),legacyOrder,item]);migrations.push(service);await migrate(pool);assert.equal((await pool.query('SELECT item_kind FROM erp_items WHERE id=$1',[item])).rows[0].item_kind,'STOCK');assert.equal((await pool.query('SELECT item_kind FROM erp_order_lines WHERE order_id=$1',[legacyOrder])).rows[0].item_kind,'STOCK');
  } finally {
    if(!migrations.includes(last)) migrations.push(last);
    if(!migrations.includes(recommendation)) migrations.push(recommendation);
    if(!migrations.includes(policy)) migrations.push(policy);
    if(!migrations.includes(award)) migrations.push(award);
    if(!migrations.includes(service)) migrations.push(service);
    if(!migrations.includes(qualification)) migrations.push(qualification);
    if(!migrations.includes(exceptionOwnership)) migrations.push(exceptionOwnership);
    await pool.end();await owner.query(`DROP SCHEMA "${schema}" CASCADE`);await owner.end();
  }
});
