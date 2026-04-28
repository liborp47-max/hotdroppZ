import { AgentId } from "./types";

interface MemoryEntry {
  agentId: AgentId | "orchestrator";
  key: string;
  value: unknown;
  timestamp: string;
  version: number;
}

class MemorySystem {
  // Shared memory: accessible by all agents
  private shared = new Map<string, MemoryEntry>();

  // Agent-scoped memory: private to each agent
  private agentMemory = new Map<string, Map<string, MemoryEntry>>();

  async write(
    agentId: AgentId | "orchestrator",
    key: string,
    value: unknown,
    scope: "shared" | "private" = "shared"
  ): Promise<void> {
    const entry: MemoryEntry = {
      agentId,
      key,
      value,
      timestamp: new Date().toISOString(),
      version: (this.read(agentId, key, scope) as MemoryEntry | null)?.version ?? 0 + 1,
    };

    if (scope === "shared") {
      this.shared.set(key, entry);
    } else {
      if (!this.agentMemory.has(agentId)) {
        this.agentMemory.set(agentId, new Map());
      }
      this.agentMemory.get(agentId)!.set(key, entry);
    }
  }

  read(
    agentId: AgentId | "orchestrator",
    key: string,
    scope: "shared" | "private" = "shared"
  ): unknown | null {
    if (scope === "shared") {
      return this.shared.get(key)?.value ?? null;
    }
    return this.agentMemory.get(agentId)?.get(key)?.value ?? null;
  }

  getSharedContext(): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};
    for (const [key, entry] of this.shared.entries()) {
      ctx[key] = entry.value;
    }
    return ctx;
  }

  getAgentHistory(agentId: AgentId): MemoryEntry[] {
    return Array.from(this.agentMemory.get(agentId)?.values() ?? []).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Key shared memory slots used across agents
  async writeArchitectureDecision(decision: {
    id: string;
    choice: string;
    reason: string;
  }): Promise<void> {
    const existing = (this.read("orchestrator", "architecture:decisions", "shared") as typeof decision[] | null) ?? [];
    await this.write("orchestrator", "architecture:decisions", [...existing, decision], "shared");
  }

  async writeDbSchema(schema: unknown): Promise<void> {
    await this.write("orchestrator", "db:schema", schema, "shared");
  }

  async writeApiSpec(spec: unknown): Promise<void> {
    await this.write("orchestrator", "api:spec", spec, "shared");
  }

  async writeDesignSystem(tokens: unknown): Promise<void> {
    await this.write("orchestrator", "design:tokens", tokens, "shared");
  }
}

export const memory = new MemorySystem();
