import { AgentTask, TaskPriority } from "./types";

interface QueuedTask extends AgentTask {
  id: string;
  queuedAt: string;
  attempts: number;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

class TaskQueue {
  private queue: QueuedTask[] = [];
  private processing = new Set<string>();

  async enqueue(task: QueuedTask): Promise<void> {
    this.queue.push({ ...task, queuedAt: new Date().toISOString(), attempts: 0 });
    this.queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    console.log(`[Queue] +1 task for ${task.agentId} | queue size: ${this.queue.length}`);
  }

  async dequeue(agentId: string): Promise<QueuedTask | null> {
    const idx = this.queue.findIndex(t => t.agentId === agentId && !this.processing.has(t.id));
    if (idx === -1) return null;
    const [task] = this.queue.splice(idx, 1);
    this.processing.add(task.id);
    return task;
  }

  complete(taskId: string): void {
    this.processing.delete(taskId);
    console.log(`[Queue] Completed task ${taskId}`);
  }

  fail(taskId: string, maxRetries = 3): boolean {
    this.processing.delete(taskId);
    const task = this.queue.find(t => t.id === taskId);
    if (task && task.attempts < maxRetries) {
      task.attempts++;
      console.warn(`[Queue] Retrying task ${taskId} (attempt ${task.attempts})`);
      return true;
    }
    console.error(`[Queue] Task ${taskId} permanently failed`);
    return false;
  }

  size(): number {
    return this.queue.length;
  }

  status(): { queued: number; processing: number } {
    return { queued: this.queue.length, processing: this.processing.size };
  }
}

export const taskQueue = new TaskQueue();
