import { z } from 'zod';
import { booksSetupInput, accountInput, accountUpdateInput, periodInput, periodStateInput, journalInput, journalUpdateInput, postJournalInput, reverseJournalInput, warehouseInput, warehouseUpdateInput, stockMovementInput, bankReconciliationInput, bankReconciliationUpdateInput, bankMatchInput } from '@erp/contracts';
import type { ApiClient } from './api-client';
type Register=(channel:string,action:(...args:any[])=>unknown)=>void;
export function registerBooksIPC(handle:Register,api:ApiClient){
 const invalid={ok:false,error:'Check the fields and refresh any changed record.'};
 function register<T extends unknown[]>(name:string,schema:z.ZodType<T>,action:(...args:T)=>unknown){handle(`books:${name}`,(...args:unknown[])=>{const result=schema.safeParse(args);return result.success?action(...result.data):{...invalid,error:result.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join(' ')};});}
 const id=z.uuid(),page=z.number().int().min(1).max(100000);
 register('overview',z.tuple([]),()=>api.booksOverview());
 register('setup',z.tuple([booksSetupInput,id]),(input,key)=>api.setupBooks(input,key));
 register('account-create',z.tuple([accountInput,id]),(input,key)=>api.createAccount(input,key));
 register('account-update',z.tuple([id,accountUpdateInput,id]),(id,input,key)=>api.updateAccount(id,input,key));
 register('period-create',z.tuple([periodInput,id]),(input,key)=>api.createPeriod(input,key));
 register('period-state',z.tuple([id,periodStateInput,id]),(id,input,key)=>api.setPeriodState(id,input,key));
 register('journals',z.tuple([page]),page=>api.listJournals(page));
 register('journal',z.tuple([id]),id=>api.getJournal(id));
 register('journal-create',z.tuple([journalInput,id]),(input,key)=>api.createJournal(input,key));
 register('journal-update',z.tuple([id,journalUpdateInput,id]),(id,input,key)=>api.updateJournal(id,input,key));
 register('journal-post',z.tuple([id,postJournalInput,id]),(id,input,key)=>api.postJournal(id,input,key));
 register('journal-reverse',z.tuple([id,reverseJournalInput,id]),(id,input,key)=>api.reverseJournal(id,input,key));
 register('warehouse-create',z.tuple([warehouseInput,id]),(input,key)=>api.createWarehouse(input,key));
 register('warehouse-update',z.tuple([id,warehouseUpdateInput,id]),(id,input,key)=>api.updateWarehouse(id,input,key));
 register('movements',z.tuple([page]),page=>api.listStockMovements(page));
 register('movement-post',z.tuple([stockMovementInput,id]),(input,key)=>api.postStockMovement(input,key));
 register('valuation',z.tuple([z.iso.date()]),date=>api.stockReconciliation(date));
 register('trial-balance',z.tuple([z.iso.date()]),date=>api.trialBalance(date));
 register('banks',z.tuple([page]),page=>api.listBankReconciliations(page));
 register('bank',z.tuple([id]),id=>api.getBankReconciliation(id));
 register('bank-create',z.tuple([bankReconciliationInput,id]),(input,key)=>api.createBankReconciliation(input,key));
 register('bank-update',z.tuple([id,bankReconciliationUpdateInput,id]),(id,input,key)=>api.updateBankReconciliation(id,input,key));
 register('bank-match',z.tuple([id,bankMatchInput,id]),(id,input,key)=>api.matchBankLine(id,input,key));
 register('bank-finalise',z.tuple([id,postJournalInput,id]),(id,input,key)=>api.finaliseBankReconciliation(id,input,key));
 register('history',z.tuple([z.enum(['books','account','period','journal','warehouse','stock_movement','bank_reconciliation']),id]),(kind,id)=>api.booksHistory(kind,id));
}
