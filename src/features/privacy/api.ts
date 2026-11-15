import { api } from '../../services/http'
export interface DataRequest {id:string;organizationId:string;kind:'export'|'erase';status:string;phase:string;createdAt:string;completedAt:string|null;expiresAt:string|null;lastError:string|null;progress:{tables:number;rows:number;objects:number}}
export interface RequestList {configuration:{enabled:boolean;policyVersion:string|null;artifactHours:number;eraseDelayHours:number;backupRetentionDays:number|null};requests:DataRequest[]}
export const listDataRequests=()=>api<RequestList>('/users/me/data-requests')
export const requestData=(input:{kind:'export'|'erase';requestId:string;password:string;confirmOrganizationId:string})=>api<DataRequest>('/privacy/requests',{method:'POST',body:input})
export const downloadParts=(id:string,offset=0)=>api<{parts:{part:number;url:string}[];total:number;nextOffset:number|null}>('/users/me/data-requests/'+id+'/download',{query:{offset,limit:20}})
export interface AuditEntry {id:string;actorType:string;actorUserId:string|null;action:string;entityType:string|null;entityId:string|null;changes:unknown;createdAt:string}
export const listAudit=(q:string,cursor?:string)=>api<{items:AuditEntry[];nextCursor:string|null}>('/audit',{query:{q:q||undefined,cursor,limit:50}})
export const exportAudit=(q:string,cursor?:string)=>api<{items:AuditEntry[];nextCursor:string|null;limitedToPage:boolean}>('/audit/export',{query:{q:q||undefined,cursor,limit:50}})
