import { CronExpressionParser } from 'cron-parser'

const DEFAULT_TZ = 'Europe/Prague'

// Silent leaf — caller decides what to log.
const localWarn = (msg: string, meta?: Record<string, unknown>): void => {
  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
     
    console.warn(`[cron-next] ${msg}`, meta ?? '')
  }
}

// Returns ISO of next fire — null if cron is missing/invalid.
// Wrapped in try/catch: never throws upstream.
export function nextCronFire(scheduleCron: string | null | undefined, tz = DEFAULT_TZ): string | null {
  if (!scheduleCron || typeof scheduleCron !== 'string' || scheduleCron.trim().length === 0) {
    return null
  }
  try {
    const it = CronExpressionParser.parse(scheduleCron, { tz })
    return it.next().toDate().toISOString()
  } catch (e) {
    localWarn('invalid cron expression', {
      scheduleCron,
      error: (e as Error).message,
    })
    return null
  }
}
