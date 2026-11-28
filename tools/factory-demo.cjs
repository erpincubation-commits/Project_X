// Creates a fresh, local-only demonstration database. Never points at .env's database.
const {randomUUID,randomBytes}=require('node:crypto');
const {resolve}=require('node:path');
const {Pool}=require('pg');
const {hash}=require('bcryptjs');

const password=process.env.FACTORY_DEMO_PASSWORD;
if(!password || password.length<12 || Buffer.byteLength(password,'utf8')>72) throw new Error('Set FACTORY_DEMO_PASSWORD privately to at least 12 characters and at most 72 UTF-8 bytes.');
const adminUrl='postgresql://p2p_test@127.0.0.1:55439/postgres';
const demoUrl='postgresql://p2p_test@127.0.0.1:55439/erp_factory_demo';
const owner=new Pool({connectionString:adminUrl,connectionTimeoutMillis:3000});
let pool,app,created=false;
(async()=>{
 try {
  const directory=(await owner.query('SHOW data_directory')).rows[0].data_directory;
  if(resolve(directory).toLowerCase()!==resolve('.local/p2p-test-cluster-user').toLowerCase()) throw new Error('The test port is not the expected isolated PostgreSQL cluster.');
  if((await owner.query("SELECT 1 FROM pg_database WHERE datname='erp_factory_demo'")).rowCount) throw new Error('The demo database already exists. It will not be overwritten.');
  await owner.query('CREATE DATABASE erp_factory_demo');created=true;
  process.env.DATABASE_URL=demoUrl;
  process.env.MFA_ENCRYPTION_KEY=randomBytes(32).toString('hex');
  require('../apps/server/dist/config.js');
  const {migrate}=require('../apps/server/dist/database/migrate.js');
  const {digest,encryptSecret}=require('../apps/server/dist/auth/crypto.js');
  pool=new Pool({connectionString:demoUrl});await migrate(pool);
  const users={},passwordHash=await hash(password,12);
  for(const [name,role] of Object.entries({admin:'admin',buyer:'purchasing',warehouse:'inventory_manager',finance:'accountant',approver:'business_approver',approver2:'business_approver'})){
   const id=randomUUID(),token=randomBytes(32).toString('hex');
   await pool.query('INSERT INTO erp_users(id,email,password_hash,role,mfa_secret) VALUES($1,$2,$3,$4,$5)',[id,`${name}@factory-demo.test`,passwordHash,role,encryptSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',id)]);
   await pool.query("INSERT INTO erp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[digest(token),id]);users[name]={id,token};
  }
  app=await require('../apps/server/dist/bootstrap.js').createApplication();await app.listen(0,'127.0.0.1');const base=await app.getUrl();
  async function call(path,method,body,who){const response=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${users[who].token}`,'Idempotency-Key':randomUUID()},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!response.ok)throw new Error(`Demo setup failed at ${method} ${path.replace(/\/[0-9a-f-]{36}/g,'/:id')} (HTTP ${response.status}).`);return response.json();}
  const today=(await pool.query('SELECT current_date::text AS date')).rows[0].date,year=today.slice(0,4);
  await call('/books/setup','POST',{currency:'INR',valuation:'MOVING_AVERAGE',confirmPostingRules:true},'admin');
  await call('/books/periods','POST',{name:'DEMO current year',startsOn:`${year}-01-01`,endsOn:`${year}-12-31`},'finance');
  const tax=await call('/trade/taxes','POST',{code:'DEMO18',name:'Demonstration input tax',rate:'18',recoverable:true,startsOn:`${year}-01-01`,endsOn:null,active:true},'finance');
  const supplier=await call('/procurement/suppliers','POST',{code:'DEMO-STEEL',name:'DEMO - Riverside Steel Components',contactEmail:'orders@riverside.example',phone:'',paymentTermsDays:30,active:true},'buyer');
  await call('/procurement/suppliers','POST',{code:'DEMO-CTRL',name:'DEMO - Apex Automation Supplies',contactEmail:'sales@apex.example',phone:'',paymentTermsDays:45,active:true},'buyer');
  const item=await call('/procurement/items','POST',{code:'DEMO-BRG',name:'DEMO - Bearing assembly',description:'Synthetic production-line spare',unit:'EA',active:true},'buyer');
  const controller=await call('/procurement/items','POST',{code:'DEMO-PLC',name:'DEMO - Line controller',description:'Synthetic factory automation part',unit:'EA',active:true},'buyer');
  const warehouse=await call('/books/warehouses','POST',{code:'DEMO-MAIN',name:'DEMO - Factory stores',active:true},'warehouse');
  let request=await call('/procurement/requests','POST',{title:'DEMO - Bearing replenishment',justification:'Maintain spares for a packaging line',currency:'INR',supplierId:supplier.id,lines:[{itemId:item.id,quantity:'100',estimatedUnitPrice:'1250'}]},'buyer');
  request=await call(`/procurement/requests/${request.id}/submit`,'POST',{version:request.version,approverId:users.approver.id},'buyer');
  request=await call(`/procurement/requests/${request.id}/decide`,'POST',{version:request.version,decision:'APPROVED',reason:'Synthetic maintenance budget approval'},'approver');
  const quote=await call('/procurement/quotes','POST',{requestId:request.id,requestVersion:request.version,supplierId:supplier.id,reference:'DEMO-Q-100',validUntil:null,lines:request.lines.map(line=>({requestLineId:line.id,unitPrice:'1250'}))},'buyer');
  let order=await call('/trade/orders','POST',{requestId:request.id,requestVersion:request.version,supplierId:supplier.id,quoteId:quote.id,date:today,description:'DEMO - Approved bearing order'},'buyer');
  order=await call(`/trade/orders/${order.id}/acknowledgement`,'POST',{version:order.version,acknowledgedOn:today,expectedOn:today,supplierReference:'DEMO-ACK-100'},'buyer');
  const receipt=await call('/trade/receipts','POST',{orderId:order.id,version:order.version,date:today,reference:'DEMO-DEL-100',warehouseId:warehouse.id,lines:[{orderLineId:order.lines[0].id,accepted:'60',damaged:'4',damageReason:'Synthetic damaged packaging'}]},'warehouse');
  let invoice=await call('/trade/supplier-invoices','POST',{orderId:order.id,reference:'DEMO-INV-100',date:today,dueDate:today,description:'DEMO - Invoice for accepted bearings',lines:[{orderLineId:order.lines[0].id,receiptLineId:receipt.lines[0].id,quantity:'60',unitPrice:'1250',taxId:tax.id}]},'finance');
  invoice=await call(`/trade/supplier-invoices/${invoice.id}/match`,'POST',{version:invoice.version},'finance');
  invoice=await call(`/trade/supplier-invoices/${invoice.id}/post`,'POST',{version:invoice.version},'finance');
  let payment=await call('/trade/payments','POST',{supplierId:supplier.id,date:today,description:'DEMO - Partial payment awaiting approval',approverIds:[users.approver.id,users.approver2.id],allocations:[{invoiceId:invoice.id,amount:'25000'}]},'finance');
  await call(`/trade/payments/${payment.id}/submit`,'POST',{version:payment.version},'finance');
  let pending=await call('/procurement/requests','POST',{title:'DEMO - Controller replacement',justification:'Synthetic line controller maintenance',currency:'INR',supplierId:null,lines:[{itemId:controller.id,quantity:'2',estimatedUnitPrice:'9800'}]},'buyer');
  await call(`/procurement/requests/${pending.id}/submit`,'POST',{version:pending.version,approverId:users.approver.id},'buyer');
  await pool.query('DELETE FROM erp_sessions');await pool.query('UPDATE erp_users SET mfa_secret=NULL');
  console.log('Created erp_factory_demo on the isolated local test cluster. Demo records are fictional.');
  console.log('Demo accounts: admin, buyer, warehouse, finance, approver and approver2 at factory-demo.test.');
 } catch(error) { console.error(error.message);if(created)console.error('A partially created demo database was retained; do not reuse it as a complete demo.');process.exitCode=1; }
 finally {await app?.close();if(pool&&created){try{await pool.query('DELETE FROM erp_sessions');await pool.query('UPDATE erp_users SET mfa_secret=NULL');}catch{console.error('Temporary demo access cleanup failed; do not use this demo database.');process.exitCode=1;}}await pool?.end();await owner.end();}
})();
