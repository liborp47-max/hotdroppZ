/**
 * Centralizované logování pro HDCC
 * Poskytuje konzistentní logging across pipeline
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export type LogEntry = {
  timestamp: string
  level: LogLevel
  message: string
  meta?: Record<string, any>
  stack?: string
}

class Logger {
  private history: LogEntry[] = []
  private maxHistory = 1000

  private createEntry(level: LogLevel, message: string, meta?: Record<string, any>, err?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
      stack: err?.stack,
    }
  }

  private addToHistory(entry: LogEntry) {
    this.history.push(entry)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }

  info(message: string, meta?: Record<string, any>) {
    const entry = this.createEntry('info', message, meta)
    this.addToHistory(entry)
    console.log(`[${entry.timestamp}] INFO: ${message}`, meta || '')
  }

  warn(message: string, meta?: Record<string, any>) {
    const entry = this.createEntry('warn', message, meta)
    this.addToHistory(entry)
    console.warn(`[${entry.timestamp}] WARN: ${message}`, meta || '')
  }

  error(message: string, err?: Error | unknown, meta?: Record<string, any>) {
    let error: Error | undefined
    if (err instanceof Error) {
      error = err
    } else if (typeof err === 'string') {
      error = new Error(err)
    }

    const entry = this.createEntry('error', message, meta, error)
    this.addToHistory(entry)
    console.error(`[${entry.timestamp}] ERROR: ${message}`, error, meta || '')
  }

  debug(message: string, meta?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      const entry = this.createEntry('debug', message, meta)
      this.addToHistory(entry)
      console.debug(`[${entry.timestamp}] DEBUG: ${message}`, meta || '')
    }
  }

  getHistory(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.history.filter((e) => e.level === level)
    }
    return [...this.history]
  }

  clearHistory() {
    this.history = []
  }

  // For debugging
  printLastN(n: number = 10) {
    const recent = this.history.slice(-n)
    recent.forEach((e) => {
      console.log(`[${e.timestamp}] ${e.level.toUpperCase()}: ${e.message}`, e.meta || '')
    })
  }
}

export const logger = new Logger()

/**
 * Structured logging helper pro API routes
 */
export function logRequest(endpoint: string, method: string, meta?: Record<string, any>) {
  logger.info(`${method} ${endpoint}`, meta)
}

export function logApiCall(service: string, endpoint: string, meta?: Record<string, any>) {
  logger.debug(`API Call: ${service} → ${endpoint}`, meta)
}

export function logPipelineStep(step: string, action: string, meta?: Record<string, any>) {
  logger.info(`Pipeline [${step}] ${action}`, meta)
}

export function logPipelineError(step: string, err: Error, meta?: Record<string, any>) {
  logger.error(`Pipeline [${step}] Error`, err, meta)
}
