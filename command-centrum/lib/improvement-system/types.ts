export type ImprovementStatus = 'open' | 'selected' | 'in_progress' | 'done' | 'archived'
export type ImprovementPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type ImprovementProposal = {
  id: string
  title: string
  sourceSection: string
  route?: string
  currentState: string[]
  detectedProblems: string[]
  improvementIdeas: string[]
  expectedImpact: string[]
  requiredTools: string[]
  suggestedAgents: string[]
  implementationSteps: string[]
  priority: ImprovementPriority
  createdAt: string
  updatedAt: string
  status: ImprovementStatus
}

export type BrainstormingPointCategory =
  | 'goals'
  | 'features'
  | 'data'
  | 'ux'
  | 'risks'
  | 'implementation'

export type BrainstormingPoint = {
  id: string
  category: BrainstormingPointCategory
  label: string
  description: string
  impact: ImprovementPriority
  recommended?: boolean
}

export type BrainstormingCategory = {
  id: BrainstormingPointCategory
  title: string
  points: BrainstormingPoint[]
}

export type BrainstormingAnalysis = {
  id: string
  brainstormingItemId: string
  sourceIdea: string
  categories: BrainstormingCategory[]
  createdByAgent: 'BRAINSTORMING AGENT'
  createdAt: string
  updatedAt: string
  status: 'draft' | 'ready' | 'prompt_created'
}

export type BrainstormingSelection = {
  id: string
  brainstormingItemId: string
  analysisId: string
  selectedPoints: BrainstormingPoint[]
  createdByAgent: 'BRAINSTORMING AGENT'
  createdAt: string
  updatedAt: string
}

export type BrainstormingPrompt = {
  id: string
  brainstormingItemId: string
  sourceIdea: string
  selectedPoints: BrainstormingPoint[]
  generatedPrompt: string
  createdByAgent: 'BRAINSTORMING AGENT'
  createdAt: string
  updatedAt: string
  status: 'draft' | 'ready' | 'used' | 'archived'
}

export type ImprovementDashboardPayload = {
  items: ImprovementProposal[]
  analyses: BrainstormingAnalysis[]
  selections: BrainstormingSelection[]
  prompts: BrainstormingPrompt[]
  agents: Array<{
    id: string
    name: string
    scope: string
    path: string
  }>
}
