import { AgentTask, AgentResult, AgentId, TaskPriority } from "./types";
import { taskQueue } from "./task-queue";
import { memory } from "./memory-system";

const AGENT_REGISTRY: Record<AgentId, { name: string; group: string }> = {
  "system-architect":  { name: "System Architect",       group: "CORE SYSTEM" },
  "backend-engineer":  { name: "Backend Engineer",        group: "CORE SYSTEM" },
  "db-engineer":       { name: "Database Engineer",       group: "CORE SYSTEM" },
  "api-integration":   { name: "API Integration",         group: "CORE SYSTEM" },
  "frontend-engineer": { name: "Web Frontend",            group: "FRONTEND & APP" },
  "mobile-engineer":   { name: "Mobile App",              group: "FRONTEND & APP" },
  "ui-ux-designer":    { name: "UI/UX Designer",          group: "FRONTEND & APP" },
  "ai-pipeline":       { name: "AI Pipeline Engineer",    group: "AI SYSTEM" },
  "prompt-engineer":   { name: "Prompt Engineer",         group: "AI SYSTEM" },
  "ai-validator":      { name: "AI Output Validator",     group: "AI SYSTEM" },
  "devops":            { name: "DevOps",                  group: "INFRASTRUCTURE" },
  "performance":       { name: "Performance Optimization",group: "INFRASTRUCTURE" },
  "security":          { name: "Security",                group: "INFRASTRUCTURE" },
  "product-manager":   { name: "Product Manager",         group: "PRODUCT & CONTROL" },
  "qa":                { name: "QA / Testing",            group: "PRODUCT & CONTROL" },
  "analytics":         { name: "Analytics Engineer",      group: "PRODUCT & CONTROL" },
};

// Development flow — order in which agents hand off work
const DEVELOPMENT_FLOW: AgentId[] = [
  "product-manager",
  "system-architect",
  "db-engineer",
  "backend-engineer",
  "frontend-engineer",
  "mobile-engineer",
  "ai-pipeline",
  "devops",
  "qa",
  "performance",
  "security",
  "analytics",
];

export class Orchestrator {
  async dispatch(task: AgentTask): Promise<string> {
    const taskId = crypto.randomUUID();
    await taskQueue.enqueue({ ...task, id: taskId });
    await memory.write("orchestrator", `task:${taskId}`, {
      status: "queued",
      agent: task.agentId,
      task: task.task,
      queuedAt: new Date().toISOString(),
    });
    console.log(`[Orchestrator] Dispatched task ${taskId} → ${task.agentId}`);
    return taskId;
  }

  async receiveResult(result: AgentResult): Promise<void> {
    await memory.write(result.agentId, `result:${result.taskId}`, result);
    console.log(`[Orchestrator] Result from ${result.agentId}: ${result.status}`);

    if (result.nextAgents && result.nextAgents.length > 0) {
      for (const nextAgentId of result.nextAgents) {
        await this.dispatch({
          agentId: nextAgentId as AgentId,
          task: `Continue from ${result.agentId} output`,
          context: { previousResult: result },
          priority: "normal",
        });
      }
    }
  }

  async runFullDevelopmentFlow(initiative: string): Promise<void> {
    console.log(`[Orchestrator] Starting development flow: ${initiative}`);
    let previousResult: AgentResult | null = null;

    for (const agentId of DEVELOPMENT_FLOW) {
      const taskId = await this.dispatch({
        agentId,
        task: initiative,
        context: previousResult ? { previousResult } : {},
        priority: "normal",
      });
      console.log(`[Orchestrator] → ${AGENT_REGISTRY[agentId].name} (${taskId})`);
    }
  }

  listAgents(): typeof AGENT_REGISTRY {
    return AGENT_REGISTRY;
  }
}

export const orchestrator = new Orchestrator();
