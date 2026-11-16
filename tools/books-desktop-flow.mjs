import assert from 'node:assert/strict';
import {resolve} from 'node:path';
export async function booksDesktopFlow({admin,client,pool,root,applications}){
 await admin.getByRole('button',{name:'Accounting & stock',exact:true}).click();
 await admin.getByLabel('I have reviewed the INR posting rules and initial account mappings.',{exact:true}).check();
 await admin.getByRole('button',{name:'Initialise INR books',exact:true}).click();
 await admin.getByRole('heading',{name:'Chart of accounts',exact:true}).waitFor();
 await admin.getByRole('button',{name:'Account security and access',exact:true}).click();
 for(const role of ['accountant','inventory_manager']){
  await admin.getByLabel('New user email',{exact:true}).fill(`${role}@smoke.test`);
  await admin.getByLabel('Initial password',{exact:true}).fill('desktop-test-password');
  await admin.getByLabel('Role',{exact:true}).selectOption(role);
  await admin.getByRole('button',{name:'Create account',exact:true}).click();
  await admin.getByRole('cell',{name:`${role}@smoke.test`,exact:true}).waitFor();
 }
 const accountant=await client('accountant');
 const dates=(await pool.query('SELECT current_date::text AS date,(current_date-1)::text AS bank_date')).rows[0],date=dates.date,bankDate=dates.bank_date,year=bankDate.slice(0,4);
 await accountant.getByLabel('Period name',{exact:true}).fill('Current financial period');
 await accountant.getByLabel('Period start',{exact:true}).fill(`${year}-01-01`);
 await accountant.getByLabel('Period end',{exact:true}).fill(`${year}-12-31`);
 await accountant.getByRole('button',{name:'Create accounting period',exact:true}).click();
 await accountant.getByRole('cell',{name:'Current financial period',exact:true}).waitFor();
 await accountant.getByLabel('Account code',{exact:true}).fill('6000');
 await accountant.getByLabel('Account name',{exact:true}).fill('Office costs');
 await accountant.getByRole('button',{name:'Save account',exact:true}).click();
 await accountant.getByRole('cell',{name:'Office costs',exact:true}).waitFor();
 await accountant.getByRole('button',{name:'Journals',exact:true}).click();
 await accountant.getByRole('button',{name:'New journal',exact:true}).click();
 await accountant.getByLabel('Journal date',{exact:true}).fill(bankDate);
 await accountant.getByLabel('Journal description',{exact:true}).fill('Initial bank capital');
 await accountant.getByLabel('Cash flow category',{exact:true}).selectOption('FINANCING');
 await accountant.getByLabel('Journal account 1',{exact:true}).selectOption({label:'1110 · Bank'});
 await accountant.getByLabel('Journal account 2',{exact:true}).selectOption({label:'3100 · Opening equity'});
 await accountant.getByLabel('Debit 1',{exact:true}).fill('100');
 await accountant.getByLabel('Credit 2',{exact:true}).fill('100');
 await accountant.getByRole('button',{name:'Save balanced draft',exact:true}).click();
 await accountant.getByRole('heading',{name:'J-1 · DRAFT',exact:true}).waitFor();
 await accountant.getByRole('button',{name:'Post journal',exact:true}).click();
 await accountant.getByRole('heading',{name:'J-1 · POSTED',exact:true}).waitFor();
 await accountant.getByRole('button',{name:'Bank statements',exact:true}).click();
 await accountant.getByRole('button',{name:'New bank statement',exact:true}).click();
 await accountant.getByLabel('Statement start',{exact:true}).fill(bankDate);
 await accountant.getByLabel('Statement end',{exact:true}).fill(bankDate);
 await accountant.getByLabel('Statement closing INR',{exact:true}).fill('100');
 await accountant.getByLabel('Statement date 1',{exact:true}).fill(bankDate);
 await accountant.getByLabel('Statement reference 1',{exact:true}).fill('Capital');
 await accountant.getByLabel('Statement amount 1',{exact:true}).fill('100');
 await accountant.getByRole('button',{name:'Save bank statement',exact:true}).click();
 await accountant.getByLabel('Match Capital',{exact:true}).selectOption({label:`J-1 · ${bankDate} · 100.00`});
 await accountant.getByRole('button',{name:'Save match Capital',exact:true}).click();
 await accountant.getByRole('button',{name:'Finalise bank reconciliation',exact:true}).click();
 await accountant.getByText(/FINALISED · version/).waitFor();
 const warehouse=await client('inventory_manager');
 await warehouse.getByRole('button',{name:'Warehouses & stock',exact:true}).click();
 for(const [code,name]of [['MAIN','Main warehouse'],['SECOND','Second warehouse']]){
  await warehouse.getByLabel('Warehouse code',{exact:true}).fill(code);
  await warehouse.getByLabel('Warehouse name',{exact:true}).fill(name);
  await warehouse.getByRole('button',{name:'Save warehouse',exact:true}).click();
  await warehouse.getByRole('cell',{name:code,exact:true}).waitFor();
 }
 async function move(kind,quantity,unitCost,source='MAIN',destination){
  await warehouse.getByLabel('Movement type',{exact:true}).selectOption(kind);
  await warehouse.getByLabel('Movement date',{exact:true}).fill(date);
  await warehouse.getByLabel('Stock item',{exact:true}).selectOption({label:'ITEM-SMOKE · Workshop item (EA)'});
  await warehouse.getByLabel('Source warehouse',{exact:true}).selectOption({label:source==='MAIN'?'MAIN · Main warehouse':'SECOND · Second warehouse'});
  if(destination)await warehouse.getByLabel('Destination warehouse',{exact:true}).selectOption({label:'SECOND · Second warehouse'});
  await warehouse.getByLabel(kind==='COUNT'?'Counted quantity':'Movement quantity',{exact:true}).fill(quantity);
  if(unitCost)await warehouse.getByLabel('Incoming unit cost INR',{exact:true}).fill(unitCost);
  await warehouse.getByLabel('Stock movement reason',{exact:true}).fill(`Desktop ${kind.toLowerCase()} evidence`);
  const before=Number((await pool.query('SELECT count(*) FROM erp_stock_movements')).rows[0].count);
  await warehouse.getByRole('button',{name:'Post stock and ledger',exact:true}).click();
  await warehouse.getByRole('button',{name:`History ST-${before+1}`,exact:true}).waitFor();
 }
 await move('OPENING','10','10');await move('INCREASE','10','20');await move('TRANSFER','2',null,'MAIN','SECOND');await move('CONSUME','1',null,'SECOND');await move('COUNT','17','0');
 await accountant.getByRole('button',{name:'Reconciliation',exact:true}).click();
 await accountant.getByText('RECONCILED',{exact:true}).waitFor();
 assert.equal((await accountant.getByText('INR 270.00',{exact:true}).count()),2);
 const accountantApp=applications.find(application=>application.windows().includes(accountant));
 const accountantWindow=await accountantApp.browserWindow(accountant);await accountantWindow.evaluate(window=>window.showInactive());
 await accountant.screenshot({path:resolve(root,'.local/books-reconciliation.png'),fullPage:true});
 assert.equal((await pool.query("SELECT count(*) FROM erp_journals WHERE source='STOCK' AND status='POSTED'")).rows[0].count,'5');
 assert.equal((await pool.query('SELECT sum(value)::text AS value FROM erp_stock_balances')).rows[0].value,'270.00');
 // Close/reopen through the desktop, with a reason and an exact stock tie-out.
 await accountant.getByRole('button',{name:'Chart & periods',exact:true}).click();
 await accountant.getByLabel('Reason for close or reopen',{exact:true}).fill('Reviewed reconciliation');
 await accountant.getByRole('button',{name:'Close Current financial period',exact:true}).click();
 await accountant.getByRole('button',{name:'Reopen Current financial period',exact:true}).waitFor();
 await accountant.getByLabel('Reason for close or reopen',{exact:true}).fill('Authorised adjustment window');
 await accountant.getByRole('button',{name:'Reopen Current financial period',exact:true}).click();
 await accountant.getByRole('button',{name:'Close Current financial period',exact:true}).waitFor();
 console.log('PASS: INR setup, accounts, period close/reopen, balanced journal, bank matching and weighted stock postings reconcile across desktop roles.');
 return {accountant,warehouse};
}
