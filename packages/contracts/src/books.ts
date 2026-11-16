import { z } from 'zod';
import { decimalInput, versionInput, type Page, type RecordHistory } from './procurement';
import type { Result } from './index';

const name = z.string().trim().min(1).max(160).refine(v=>!/[\x00-\x1f\x7f]/.test(v),'Control characters are not allowed.');
const reason = z.string().trim().min(3).max(1000).refine(v=>!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v),'Control characters are not allowed.');
const code = name.max(32).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).transform(v=>v.toUpperCase());
export const moneyInput = decimalInput(16,2,false);
const signedMoney = z.string().trim().regex(/^-?(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/);
export const booksSetupInput = z.object({currency:z.literal('INR'),valuation:z.literal('MOVING_AVERAGE'),confirmPostingRules:z.literal(true)}).strict();
export const accountInput = z.object({code,name,type:z.enum(['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE']),active:z.boolean().default(true)}).strict();
export const accountUpdateInput = z.object({name,active:z.boolean(),version:versionInput}).strict();
export const periodInput = z.object({name,startsOn:z.iso.date(),endsOn:z.iso.date()}).strict().refine(v=>v.startsOn<=v.endsOn,'Period end must follow its start.');
export const periodStateInput = z.object({version:versionInput,status:z.enum(['OPEN','CLOSED']),reason}).strict();
export const journalLineInput = z.object({accountId:z.uuid(),debit:moneyInput,credit:moneyInput,memo:z.string().trim().max(200).refine(v=>!/[\x00-\x1f\x7f]/.test(v)).default('')}).strict().refine(v=>(/[1-9]/.test(v.debit)&&!/[1-9]/.test(v.credit))||(!/[1-9]/.test(v.debit)&&/[1-9]/.test(v.credit)),'Each line must have one positive debit or credit.');
export const journalInput = z.object({date:z.iso.date(),description:reason,cashFlowCategory:z.enum(['OPERATING','INVESTING','FINANCING','UNCLASSIFIED']).optional(),lines:z.array(journalLineInput).min(2).max(100)}).strict();
export const journalUpdateInput = journalInput.extend({version:versionInput});
export const postJournalInput = z.object({version:versionInput}).strict();
export const reverseJournalInput = z.object({version:versionInput,date:z.iso.date(),reason}).strict();
export const warehouseInput = z.object({code,name,active:z.boolean().default(true)}).strict();
export const warehouseUpdateInput = z.object({name,active:z.boolean(),version:versionInput}).strict();
export const stockMovementInput = z.object({kind:z.enum(['OPENING','INCREASE','DECREASE','CONSUME','TRANSFER','COUNT']),date:z.iso.date(),reason,itemId:z.uuid(),warehouseId:z.uuid(),destinationId:z.uuid().nullable().default(null),quantity:decimalInput(12,6,false),unitCost:decimalInput(10,6,false).default('0'),version:versionInput.nullable().default(null)}).strict()
 .refine(v=>(v.kind==='TRANSFER')===(v.destinationId!==null),'A transfer requires a destination; other movements must not have one.')
 .refine(v=>v.destinationId!==v.warehouseId,'Choose a different destination warehouse.')
 .refine(v=>v.kind==='COUNT'||/[1-9]/.test(v.quantity),'Quantity must be positive.')
 .refine(v=>!['OPENING','INCREASE'].includes(v.kind)||/[1-9]/.test(v.unitCost),'Inbound stock requires a positive unit cost.')
 .refine(v=>['OPENING','INCREASE','COUNT'].includes(v.kind)||!/[1-9]/.test(v.unitCost),'Outgoing and transfer cost is calculated by the server.')
 .refine(v=>v.kind!=='COUNT'||v.version!==null,'A count requires the current stock balance version.');
export const booksQueryInput = z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
export const cutoffInput = z.object({date:z.iso.date()}).strict();
export const bankReconciliationInput = z.object({accountId:z.uuid(),startsOn:z.iso.date(),endsOn:z.iso.date(),opening:signedMoney,closing:signedMoney,lines:z.array(z.object({date:z.iso.date(),reference:name,amount:signedMoney.refine(v=>/[1-9]/.test(v),'Statement amount cannot be zero.')} ).strict()).min(0).max(100)}).strict()
 .refine(v=>v.startsOn<=v.endsOn,'Invalid statement period.').refine(v=>v.lines.every(l=>l.date>=v.startsOn&&l.date<=v.endsOn),'Statement lines must fall inside its period.');
export const bankMatchInput = z.object({version:versionInput,statementLineId:z.uuid(),journalLineId:z.uuid().nullable()}).strict();
export const bankReconciliationUpdateInput = bankReconciliationInput.safeExtend({version:versionInput});
export type AccountInput=z.infer<typeof accountInput>;
export type AccountUpdateInput=z.infer<typeof accountUpdateInput>;
export type PeriodInput=z.infer<typeof periodInput>;
export type PeriodStateInput=z.infer<typeof periodStateInput>;
export type JournalInput=z.infer<typeof journalInput>;
export type JournalUpdateInput=z.infer<typeof journalUpdateInput>;
export type StockMovementInput=z.infer<typeof stockMovementInput>;
export type BankReconciliationInput=z.infer<typeof bankReconciliationInput>;
export type BankMatchInput=z.infer<typeof bankMatchInput>;
export interface Account {id:string;code:string;name:string;type:AccountInput['type'];control:string|null;active:boolean;version:number}
export interface Period {id:string;name:string;startsOn:string;endsOn:string;status:'OPEN'|'CLOSED';version:number}
export interface Warehouse {id:string;code:string;name:string;active:boolean;version:number}
export interface BooksOverview {configured:boolean;currency:'INR'|null;valuation:'MOVING_AVERAGE'|null;accounts:Account[];periods:Period[];warehouses:Warehouse[]}
export interface JournalLine {id:string;accountId:string;accountCode:string;accountName:string;debit:string;credit:string;memo:string}
export interface Journal {id:string;number:string;date:string;description:string;cashFlowCategory:'OPERATING'|'INVESTING'|'FINANCING'|'UNCLASSIFIED';status:'DRAFT'|'POSTED';source:'MANUAL'|'STOCK'|'REVERSAL'|'AP_INVOICE'|'AR_INVOICE'|'AP_PAYMENT'|'AR_COLLECTION';sourceId:string|null;reversedOf:string|null;reversalId:string|null;version:number;createdBy:string;postedBy:string|null;createdAt:string;postedAt:string|null;lines:JournalLine[]}
export interface StockMovement {id:string;sequence:string;kind:StockMovementInput['kind']|'RECEIPT';date:string;reason:string;itemId:string;itemCode:string;warehouseId:string;warehouseCode:string;destinationId:string|null;destinationCode:string|null;quantity:string;value:string;journalId:string|null;actorId:string;createdAt:string;receiptLineId?:string|null}
export interface ValuationRow {itemId:string;itemCode:string;itemName:string;warehouseId:string;warehouseCode:string;quantity:string;value:string;averageCost:string;version:number|null;projectionQuantity:string|null;projectionValue:string|null;projectionMatches:boolean|null}
export interface StockReconciliation {date:string;currency:'INR';stockValue:string;ledgerValue:string;difference:string;balanced:boolean;rows:ValuationRow[]}
export interface TrialBalance {date:string;currency:'INR';debit:string;credit:string;balanced:boolean;accounts:(Account&{debit:string;credit:string;balance:string})[]}
export interface BankStatementLine {id:string;date:string;reference:string;amount:string;journalLineId:string|null}
export interface BankLedgerLine {id:string;journalId:string;number:string;date:string;amount:string;matched:boolean}
export interface BankReconciliation {id:string;accountId:string;startsOn:string;endsOn:string;opening:string;closing:string;status:'DRAFT'|'FINALISED';version:number;lines:BankStatementLine[];ledgerLines:BankLedgerLine[];ledgerOpening:string;ledgerClosing:string;statementCalculatedClosing:string;outstanding:string;adjustedClosing:string;expectedOpening:string;ready:boolean}
export type BooksHistoryKind='books'|'account'|'period'|'journal'|'warehouse'|'stock_movement'|'bank_reconciliation';
export interface BooksAPI {
 booksOverview():Promise<Result<BooksOverview>>;
 setupBooks(input:z.infer<typeof booksSetupInput>,key:string):Promise<Result<BooksOverview>>;
 createAccount(input:AccountInput,key:string):Promise<Result<Account>>;
 updateAccount(id:string,input:AccountUpdateInput,key:string):Promise<Result<Account>>;
 createPeriod(input:PeriodInput,key:string):Promise<Result<Period>>;
 setPeriodState(id:string,input:PeriodStateInput,key:string):Promise<Result<Period>>;
 listJournals(page:number):Promise<Result<Page<Journal>>>;
 getJournal(id:string):Promise<Result<Journal>>;
 createJournal(input:JournalInput,key:string):Promise<Result<Journal>>;
 updateJournal(id:string,input:JournalUpdateInput,key:string):Promise<Result<Journal>>;
 postJournal(id:string,input:z.infer<typeof postJournalInput>,key:string):Promise<Result<Journal>>;
 reverseJournal(id:string,input:z.infer<typeof reverseJournalInput>,key:string):Promise<Result<Journal>>;
 createWarehouse(input:z.infer<typeof warehouseInput>,key:string):Promise<Result<Warehouse>>;
 updateWarehouse(id:string,input:z.infer<typeof warehouseUpdateInput>,key:string):Promise<Result<Warehouse>>;
 listStockMovements(page:number):Promise<Result<Page<StockMovement>>>;
 postStockMovement(input:StockMovementInput,key:string):Promise<Result<StockMovement>>;
 stockReconciliation(date:string):Promise<Result<StockReconciliation>>;
 trialBalance(date:string):Promise<Result<TrialBalance>>;
 listBankReconciliations(page:number):Promise<Result<Page<BankReconciliation>>>;
 getBankReconciliation(id:string):Promise<Result<BankReconciliation>>;
 createBankReconciliation(input:BankReconciliationInput,key:string):Promise<Result<BankReconciliation>>;
 updateBankReconciliation(id:string,input:z.infer<typeof bankReconciliationUpdateInput>,key:string):Promise<Result<BankReconciliation>>;
 matchBankLine(id:string,input:BankMatchInput,key:string):Promise<Result<BankReconciliation>>;
 finaliseBankReconciliation(id:string,input:z.infer<typeof postJournalInput>,key:string):Promise<Result<BankReconciliation>>;
 booksHistory(kind:BooksHistoryKind,id:string):Promise<Result<RecordHistory[]>>;
}
