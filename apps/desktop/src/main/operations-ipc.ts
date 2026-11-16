import {z} from 'zod';
import { importInput,importCommitInput,privacyInput,privacyActionInput } from '@erp/contracts';
import type {ApiClient} from './api-client';
type Register=(channel:string,action:(...args:any[])=>unknown)=>void;
export function registerOperationsIPC(handle:Register,api:ApiClient) {
 function register<T extends unknown[]>(name:string,schema:z.ZodType<T>,action:(...args:T)=>unknown){handle(`operations:${name}`,(...args:unknown[])=>{const r=schema.safeParse(args);return r.success?action(...r.data):{ok:false,error:r.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(' ')};});}
 const uuid=z.uuid();
 register('previewImport',z.tuple([importInput,uuid]),(input,key)=>api.previewImport(input,key));
 register('commitImport',z.tuple([uuid,importCommitInput,uuid]),(id,input,key)=>api.commitImport(id,input,key));
 register('listPrivacyCases',z.tuple([z.number().int().min(1).max(100000)]),page=>api.listPrivacyCases(page));
 register('createPrivacyCase',z.tuple([privacyInput,uuid]),(input,key)=>api.createPrivacyCase(input,key));
 register('privacyAction',z.tuple([uuid,privacyActionInput,uuid]),(id,input,key)=>api.privacyAction(id,input,key));
 register('exportPrivacyCase',z.tuple([uuid]),id=>api.exportPrivacyCase(id));
}
