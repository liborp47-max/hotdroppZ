/**
 * HDUA Content API — unified error envelope (HDUA-02 #06).
 *
 * Every Content API call (`src/api/content.ts`, `src/api/user.ts`) throws a
 * `ContentApiError` instead of an ad-hoc `Error`, so callers get a stable,
 * typed shape: `{ endpoint, code, status, message, dbCode }`. The human-facing
 * `.message` is preserved verbatim from the previous ad-hoc strings, so existing
 * UI that renders `e.message` (auth.tsx, profile/edit.tsx, …) keeps working — the
 * structured fields are additive.
 *
 * When the dedicated server-tier (NestJS) lands, it can serialize this exact
 * envelope as the HTTP error body without touching any caller. CORS, ETag/cache
 * and rate limiting remain server-tier concerns (see docs/HDUA_API.md, decision
 * #2); on the client, response caching is already provided by TanStack Query.
 */
import type { PostgrestError } from '@supabase/supabase-js'

export type ContentApiErrorCode =
  | 'unauthenticated' // no signed-in user / RLS denied
  | 'conflict' // unique violation (e.g. username taken)
  | 'not_found' // row/resource missing
  | 'rate_limited' // server-tier throttle (reserved)
  | 'db_error' // PostgREST/Postgres failure
  | 'network' // transport failure
  | 'unknown'

/** HTTP-equivalent status per code — what the server-tier will return verbatim. */
const STATUS_BY_CODE: Record<ContentApiErrorCode, number> = {
  unauthenticated: 401,
  conflict: 409,
  not_found: 404,
  rate_limited: 429,
  db_error: 502,
  network: 503,
  unknown: 500,
}

/** Plain, serializable form — the future HTTP error body. */
export interface ContentApiErrorEnvelope {
  endpoint: string
  code: ContentApiErrorCode
  status: number
  message: string
  dbCode?: string
}

export class ContentApiError extends Error {
  readonly endpoint: string
  readonly code: ContentApiErrorCode
  readonly status: number
  readonly dbCode?: string

  constructor(init: {
    endpoint: string
    code: ContentApiErrorCode
    message: string
    dbCode?: string
    status?: number
  }) {
    super(init.message)
    this.name = 'ContentApiError'
    this.endpoint = init.endpoint
    this.code = init.code
    this.status = init.status ?? STATUS_BY_CODE[init.code]
    this.dbCode = init.dbCode
    // Restore prototype chain for instanceof across the TS→RN transpile target.
    Object.setPrototypeOf(this, ContentApiError.prototype)
  }

  get envelope(): ContentApiErrorEnvelope {
    return {
      endpoint: this.endpoint,
      code: this.code,
      status: this.status,
      message: this.message,
      ...(this.dbCode ? { dbCode: this.dbCode } : {}),
    }
  }
}

/** Map a raw Postgres / PostgREST error code to our envelope code. */
export function classifyDbCode(dbCode?: string): ContentApiErrorCode {
  switch (dbCode) {
    case '23505':
      return 'conflict' // unique_violation
    case 'PGRST116':
      return 'not_found' // 0 rows where 1 expected
    case '42501':
      return 'unauthenticated' // insufficient_privilege (RLS)
    case undefined:
    case '':
      return 'db_error'
    default:
      return 'db_error'
  }
}

type DbLikeError = Pick<PostgrestError, 'message'> & { code?: string }

/**
 * Wrap a Supabase/PostgREST error. Preserves the legacy `${endpoint}: ${message}`
 * string so UI error rendering is unchanged; pass an explicit `message` to
 * override (e.g. a localized, user-safe sentence).
 */
export function dbError(endpoint: string, error: DbLikeError, message?: string): ContentApiError {
  return new ContentApiError({
    endpoint,
    code: classifyDbCode(error.code),
    dbCode: error.code,
    message: message ?? `${endpoint}: ${error.message}`,
  })
}

/** No signed-in session. Message kept as the legacy `'not authenticated'`. */
export function unauthenticated(endpoint: string, message = 'not authenticated'): ContentApiError {
  return new ContentApiError({ endpoint, code: 'unauthenticated', message })
}
