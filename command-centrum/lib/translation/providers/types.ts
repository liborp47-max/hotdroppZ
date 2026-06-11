export type TranslationRequest = {
  systemPrompt: string
  userContent:  string
  maxTokens?:   number
}

export type TranslationResponse = {
  text:     string
  tokens:   number
  provider: string
}

export interface TranslationProvider {
  readonly name: string
  isAvailable(): boolean
  call(req: TranslationRequest): Promise<TranslationResponse>
}
