// Shared utilities for pipeline modules — import from here, not inline

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

type SupabaseErrorLike = { code?: string; message?: string } | null | undefined

export function isSchemaGapError(error: SupabaseErrorLike): boolean {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  return (
    error.code === '42P01' ||   // table does not exist
    error.code === '42703' ||   // column does not exist
    error.code === 'PGRST204' || // PostgREST schema cache miss
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the')
  )
}
