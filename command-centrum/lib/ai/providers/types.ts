export type AiCallOpts = {
  maxTokens?:   number
  temperature?: number
}

export type AiCallResult = {
  text:   string
  tokens: number
}

export interface AiProviderClient {
  readonly id: string
  isAvailable(): boolean
  call(system: string, user: string, opts?: AiCallOpts): Promise<AiCallResult>
}
