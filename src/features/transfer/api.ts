import type { Overlay, SourceRow, ImportIssue } from '../../lib/importCore'
import { api } from '../../services/http'
import type { FileRecord } from '../files/api'
export type TransferEntity = 'lead' | 'contact' | 'company' | 'deal'
export interface ImportOptions { duplicateStrategy: 'skip' | 'update' | 'create'; updateMode: 'empty' | 'overwrite'; dateFormat: 'DMY' | 'MDY'; defaultOwnerId?: string | null; createMissingSources?: boolean; maxRows?: number }
export interface ImportJob { id: string; entityType: TransferEntity; status: string; mapping: Record<string, string>; options: ImportOptions; totalRows: number; processed: number; created: number; updated: number; skipped: number; failed: number; createdAt: string; finishedAt: string | null; lastError?: string | null; revision: number; edits: Overlay; hasHeader: boolean; headerRow: number; sheetName?: string | null; headers?: string[]; sheets?: string[]; sampleRows?: string[][] }
export interface ReviewRow { id: string; row: number | null; index: number; input: Record<string, unknown>; values: Record<string, string | number>; raw: string[]; originalValues: Record<string, string>; issues: ImportIssue[]; warnings: string[]; errors: string[]; duplicate: boolean; edited: boolean; editedFields: string[]; status: 'ready' | 'warning' | 'error' | 'duplicate'; action: 'create' | 'update' | 'skip'; reason?: string }
export interface Preview {
  status: 'stale' | 'pending' | 'running' | 'complete' | 'error'; revision: number; rows: ReviewRow[]; message?: string; fields?: string[]; totalRows?: number; filteredTotal?: number; offset?: number; generatedAt?: string;
  availableRecordSlots?: number | null; estimatedCreates?: number;
  counts?: Record<'all' | 'ready' | 'attention' | 'duplicates' | 'edited', number>;
  summary?: { rowsInFile: number; totalRows: number; willCreate: number; willUpdate: number; willSkip: number; errorRows: number; editedCells: number; removedRows: number; addedRows: number }
}
export interface Dataset { rows: SourceRow[]; totalSourceRows: number; totalRows: number; columns: { key: string; index: number; label: string }[]; headerRow: number; hasHeader: boolean; sheetName: string | null; sheets: string[]; cellIssues: Record<string, ImportIssue>; revision: number; edits: Overlay; offset: number }
export interface DraftUpdate extends Partial<Pick<ImportJob, 'sheetName' | 'headerRow' | 'mapping' | 'options' | 'hasHeader'>> { mappingName?: string; autoDetect?: boolean; revision?: number; editBatch?: { reset?: boolean; cells?: { rowId: string; column: number; value: string | null }[]; deletedRows?: { rowId: string; deleted: boolean }[]; addedRows?: Overlay['addedRows'] } }
export const getImportDataset = (id: string, offset = 0) => api<Dataset>(`/imports/${id}/dataset`, { query: { offset, limit: 1000 } })
export const getImportPreview = (id: string, query: { offset?: number; filter?: string; q?: string } = {}) => api<Preview>(`/imports/${id}/preview`, { query })
export const createImport = (entityType: TransferEntity, fileId: string) => api<ImportJob>('/imports', { method: 'POST', body: { entityType, fileId } })
export const updateImport = (id: string, values: DraftUpdate) => api<ImportJob>(`/imports/${id}`, { method: 'PATCH', body: values })
export const previewImport = (id: string, query: { offset?: number; filter?: string; q?: string } = {}) => api<Preview>(`/imports/${id}/preview`, { method: 'POST', query })
export const startImport = (id: string, revision?: number, acceptSkippedRows?: boolean) => api<ImportJob>(`/imports/${id}/start`, { method: 'POST', body: revision === undefined ? undefined : { revision, acceptSkippedRows } })
export const getImport = (id: string) => api<ImportJob>(`/imports/${id}`)
export const listImports = () => api<{ imports: ImportJob[] }>('/imports').then((d) => d.imports)
export const cancelImport = (id: string) => api<ImportJob>(`/imports/${id}/cancel`, { method: 'POST' })
export const undoImport = (id: string) => api<{ removed: number; kept: number }>(`/imports/${id}/undo`, { method: 'POST' })
export const importErrors = (id: string) => api<FileRecord>(`/imports/${id}/errors`)
export interface ExportJob { exportId?: string; id?: string; status: string; file?: FileRecord; lastError?: string; entityType?: TransferEntity; format?: 'csv' | 'xlsx'; rowCount?: number; columns?: string[]; createdAt?: string; finishedAt?: string | null }
export const createExport = (entityType: TransferEntity, filters: Record<string, string | number | boolean | undefined>, columns: string[], format: 'csv' | 'xlsx') => api<ExportJob>('/exports', { method: 'POST', body: { entityType, filters, columns, format } })
export const getExport = (id: string) => api<ExportJob>(`/exports/${id}`)
export const listExports = () => api<{ exports: ExportJob[] }>('/exports').then((d) => d.exports)
