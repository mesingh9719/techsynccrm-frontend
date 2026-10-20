import { api } from '../../services/http'
import type { FileRecord } from '../files/api'
export type TransferEntity = 'lead' | 'contact' | 'company' | 'deal'
export interface ImportOptions { duplicateStrategy: 'skip' | 'update' | 'create'; updateMode: 'empty' | 'overwrite'; dateFormat: 'DMY' | 'MDY'; defaultOwnerId?: string | null; createMissingSources?: boolean; maxRows?: number }
export interface ImportJob { id: string; entityType: TransferEntity; status: string; mapping: Record<string, string>; options: ImportOptions; totalRows: number; processed: number; created: number; updated: number; skipped: number; failed: number; createdAt: string; finishedAt: string | null; lastError?: string | null; headerRow: number; sheetName?: string; headers?: string[]; sheets?: string[]; sampleRows?: string[][] }
export interface Preview { rows: { row: number; errors: string[]; warnings?: string[]; duplicate?: boolean; input?: Record<string, unknown> }[]; totalRows: number; availableRecordSlots: number | null; estimatedCreates: number }
export const createImport = (entityType: TransferEntity, fileId: string) => api<ImportJob>('/imports', { method: 'POST', body: { entityType, fileId } })
export const updateImport = (id: string, values: Partial<Pick<ImportJob, 'sheetName' | 'headerRow' | 'mapping' | 'options'>> & { mappingName?: string }) => api<ImportJob>(`/imports/${id}`, { method: 'PATCH', body: values })
export const previewImport = (id: string) => api<Preview>(`/imports/${id}/preview`, { method: 'POST' })
export const startImport = (id: string) => api<ImportJob>(`/imports/${id}/start`, { method: 'POST' })
export const getImport = (id: string) => api<ImportJob>(`/imports/${id}`)
export const listImports = () => api<{ imports: ImportJob[] }>('/imports').then((d) => d.imports)
export const cancelImport = (id: string) => api<ImportJob>(`/imports/${id}/cancel`, { method: 'POST' })
export const undoImport = (id: string) => api<{ removed: number; kept: number }>(`/imports/${id}/undo`, { method: 'POST' })
export const importErrors = (id: string) => api<FileRecord>(`/imports/${id}/errors`)
export interface ExportJob { exportId?: string; id?: string; status: string; file?: FileRecord; lastError?: string }
export const createExport = (entityType: TransferEntity, filters: Record<string, string | number | boolean | undefined>, columns: string[], format: 'csv' | 'xlsx') => api<ExportJob>('/exports', { method: 'POST', body: { entityType, filters, columns, format } })
export const getExport = (id: string) => api<ExportJob>(`/exports/${id}`)
export const listExports = () => api<{ exports: ExportJob[] }>('/exports').then((d) => d.exports)
