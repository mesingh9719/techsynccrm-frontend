import { api, upload, postToStorage } from '../../services/http'
export interface FileRecord { id: string; name: string; contentType: string; size: number; createdAt: string; deletedAt: string | null; uploadedById: string; status: string; url?: string; thumbnailUrl?: string | null }
export type FileRef = { entityType: string; entityId: string }
export const listFiles = (ref: FileRef) => api<{ files: FileRecord[] }>('/files', { query: ref }).then((d) => d.files)
export const getFile = (id: string) => api<{ file: FileRecord }>(`/files/${id}`).then((d) => d.file)
export const deleteFile = (id: string) => api<void>(`/files/${id}`, { method: 'DELETE' })
export const restoreFile = (id: string) => api<{ file: FileRecord }>(`/files/${id}/restore`, { method: 'POST' })
export async function uploadFile(file: File, ref?: FileRef, onProgress?: (n: number) => void) {
  if (file.size <= 10 * 1024 ** 2) return upload<{ file: FileRecord }>('/files', file, { fields: ref, onProgress }).then((d) => d.file)
  const intent = await api<{ fileId: string; url: string; fields: Record<string, string> }>('/files/upload-intent', { method: 'POST', body: { name: file.name, size: file.size, contentType: file.type, ...ref } })
  await postToStorage(intent.url, file, intent.fields, onProgress)
  return api<{ file: FileRecord }>(`/files/${intent.fileId}/complete`, { method: 'POST' }).then((d) => d.file)
}
