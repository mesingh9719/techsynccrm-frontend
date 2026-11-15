import { api } from '../../services/http'
export interface BillingPrice {id:string;label:string;plan:string;currency:string;amountMinor:string;interval:string;model:'workspace'|'seat';maxQuantity:number;trialDays:number;graceDays:number}
export interface BillingState {provider:string;environment:string;enabled:boolean;readOnly:boolean;missing:string[];prices:BillingPrice[];supportConfigured:boolean;subscription:null|{id:string;status:string;quantity:number;periodEnd:string|null;cancelAtPeriodEnd:boolean;graceEndsAt:string|null;reconciledAt:string}}
export const getBilling=()=>api<BillingState>('/billing')
export const startCheckout=(priceId:string,quantity:number,requestId:string)=>api<{id:string;url:string}>('/billing/checkout',{method:'POST',body:{priceId,quantity,requestId}})
export const openPortal=()=>api<{url:string}>('/billing/portal',{method:'POST'})
