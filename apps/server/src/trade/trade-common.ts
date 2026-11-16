import { ConflictException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { decimal,units } from '../books/books.service';
export const roundRatio=(n:bigint,d:bigint)=>(n+d/2n)/d;
export const lineValue=(quantity:string,price:string)=>roundRatio(units(quantity,6)*units(price,6)*100n,1000000000000n);
export const taxValue=(net:bigint,rate:string)=>roundRatio(net*units(rate,4),1000000n);
export async function controls(client:PoolClient){const rows=(await client.query('SELECT id,control FROM erp_accounts WHERE control IS NOT NULL AND active')).rows;return (code:string)=>{const row=rows.find(r=>r.control===code);if(!row)throw new ConflictException(`Missing active ${code} posting account. Initialise company books.`);return row.id as string;};}
export function postingLines(entries:{accountId:string;amount:bigint}[]){const amounts=new Map<string,bigint>();for(const e of entries)amounts.set(e.accountId,(amounts.get(e.accountId)||0n)+e.amount);return [...amounts].filter(([,amount])=>amount!==0n).map(([accountId,amount])=>({accountId,debit:amount>0n?decimal(amount):'0',credit:amount<0n?decimal(-amount):'0',memo:''}));}
export const referenceKey=(value:string)=>value.trim().toLowerCase();
