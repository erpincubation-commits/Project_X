import assert from 'node:assert/strict';
import {verifyAccessibility} from './accessibility.mjs';
export async function operationsDesktopFlow({admin,pool,root}) {
 await admin.getByRole('button',{name:'Operations & privacy',exact:true}).click();
 await admin.getByRole('heading',{name:'Preview a master import'}).waitFor();
 await verifyAccessibility(admin,'master-import',root);
 await admin.getByLabel('Records as JSON').fill(JSON.stringify([{code:'OPS-ITEM',name:'Imported desktop item',unit:'ea'}]));
 await admin.getByRole('button',{name:'Run import dry run',exact:true}).click();
 await admin.getByRole('heading',{name:'Dry run: 1 rows, 0 errors',exact:true}).waitFor();
 assert.equal((await pool.query("SELECT 1 FROM erp_items WHERE code='OPS-ITEM'")).rowCount,0);
 await admin.getByLabel('I reviewed these records and want to create all of them.').check();
 await admin.getByRole('button',{name:'Commit reviewed import',exact:true}).click();await admin.getByText('Imported 1 records. The whole batch was saved.',{exact:true}).waitFor();
 assert.equal((await pool.query("SELECT unit FROM erp_items WHERE code='OPS-ITEM'")).rows[0].unit,'EA');
 await admin.getByRole('button',{name:'Privacy requests',exact:true}).click();
 await admin.getByRole('heading',{name:'Open a privacy request',exact:true}).waitFor();
 await verifyAccessibility(admin,'privacy-register',root);
 const id=(await pool.query("SELECT id FROM erp_users WHERE email='admin@smoke.test'")).rows[0].id;
 await admin.getByLabel('Subject ID (UUID), or customer code').fill(id);await admin.getByLabel('Identity verification ticket reference').fill('SYNTHETIC-VERIFIED');
 await admin.getByRole('button',{name:'Open verified request',exact:true}).click();
 await admin.getByRole('button',{name:'Prepare access extract',exact:true}).click();
 const extract=admin.getByLabel('Operational access extract');await extract.waitFor();
 const data=JSON.parse(await extract.inputValue());assert.equal(data.record.email,'admin@smoke.test');assert.equal(JSON.stringify(data).includes('password_hash'),false);
 await verifyAccessibility(admin,'privacy-access-extract',root);
 await admin.getByLabel('Authorised decision / retention reason ticket').fill('SYNTHETIC-REVIEW-COMPLETE');await admin.getByRole('button',{name:'Record privacy decision',exact:true}).click();await admin.getByText('Privacy decision recorded.',{exact:true}).waitFor();
 console.log('PASS: desktop import dry run/commit, privacy access extract/review, and automated accessibility checks.');
}
