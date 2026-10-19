import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '../services/http'

/**
 * Maps server validation errors onto form fields. Returns the message to show at
 * form level when the error isn't tied to a known field (or null if all were mapped).
 */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, knownFields: Array<Path<T>>) {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.'
  let unmapped = Object.keys(err.fields).length === 0
  for (const [field, message] of Object.entries(err.fields)) {
    if (knownFields.includes(field as Path<T>)) setError(field as Path<T>, { message }, { shouldFocus: true })
    else unmapped = true
  }
  return unmapped ? err.message : null
}
