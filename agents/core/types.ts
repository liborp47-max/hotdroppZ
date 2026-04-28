export type AgentId =
  | "system-architect"
  | "backend-engineer"
  | "db-engineer"
  | "api-integration"
  | "frontend-engineer"
  | "mobile-engineer"
  | "ui-ux-designer"
  | "ai-pipeline"
  | "prompt-engineer"
  | "ai-validator"
  | "devops"
  | "performance"
  | "security"
  | "product-manager"
  | "qa"
  | "analytics";

export type AgentGroup =
  | "CORE SYSTEM"
  | "FRONTEND & APP"
  | "AI SYSTEM"
  | "INFRASTRUCTURE"
  | "PRODUCT & CONTROL";

export type TaskPriority = "critical" | "high" | "normal" | "low";

export type AgentStatus = "complete" | "blocked" | "in-progress";

export interface AgentTask {
  id?: string;
  agentId: AgentId;
  task: string;
  context: Record<string, unknown>;
  priority: TaskPriority;
  requestedOutput?: string;
}

export interface AgentResult {
  taskId: string;
  agentId: AgentId;
  status: AgentStatus;
  output: {
    type: string;
    content?: unknown;
    files?: Array<{ path: string; content: string; language?: string }>;
  };
  nextAgents?: AgentId[];
  memoryWrite?: string;
  timestamp: string;
}
