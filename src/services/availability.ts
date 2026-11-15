import { api } from './http'
export interface Availability { privateBeta: boolean; googleSignIn: boolean; registration: 'closed' | 'allowlist' | 'open'; integrations: string[] }
export const getAvailability = () => api<Availability>('/meta/availability')
