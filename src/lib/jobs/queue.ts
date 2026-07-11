/**
 * Job queue using an in-process + Postgres-ready contract.
 * Production choice (Phase 0): PostgreSQL FOR UPDATE SKIP LOCKED.
 * This module provides the domain API + in-memory implementation for tests/dev.
 */

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "dead_letter";

export interface ImportJob {
  id: string;
  workspaceId: string;
  batchId?: string;
  type: "import_zip" | "generate_efd" | "export";
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  lastError?: string;
  lockedAt?: string;
  heartbeatAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobQueue {
  enqueue(job: Omit<ImportJob, "id" | "status" | "attempts" | "createdAt" | "updatedAt" | "maxAttempts"> & {
    maxAttempts?: number;
  }): Promise<ImportJob>;
  claimNext(workerId: string): Promise<ImportJob | null>;
  heartbeat(jobId: string): Promise<void>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
  getByIdempotencyKey(key: string): Promise<ImportJob | null>;
}

function uid() {
  return `job_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export class InMemoryJobQueue implements JobQueue {
  private jobs = new Map<string, ImportJob>();
  private byIdem = new Map<string, string>();

  async enqueue(
    input: Omit<ImportJob, "id" | "status" | "attempts" | "createdAt" | "updatedAt" | "maxAttempts"> & {
      maxAttempts?: number;
    },
  ): Promise<ImportJob> {
    const existing = await this.getByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
    const now = new Date().toISOString();
    const job: ImportJob = {
      id: uid(),
      workspaceId: input.workspaceId,
      batchId: input.batchId,
      type: input.type,
      status: "pending",
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 5,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    this.byIdem.set(job.idempotencyKey, job.id);
    return job;
  }

  async claimNext(workerId: string): Promise<ImportJob | null> {
    for (const job of this.jobs.values()) {
      if (job.status !== "pending") continue;
      job.status = "running";
      job.attempts += 1;
      job.lockedAt = new Date().toISOString();
      job.heartbeatAt = job.lockedAt;
      job.payload = { ...job.payload, workerId };
      job.updatedAt = job.lockedAt;
      return job;
    }
    return null;
  }

  async heartbeat(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.heartbeatAt = new Date().toISOString();
    job.updatedAt = job.heartbeatAt;
  }

  async complete(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = "completed";
    job.updatedAt = new Date().toISOString();
  }

  async fail(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.lastError = error;
    job.updatedAt = new Date().toISOString();
    if (job.attempts >= job.maxAttempts) {
      job.status = "dead_letter";
    } else {
      job.status = "pending";
      job.lockedAt = undefined;
    }
  }

  async getByIdempotencyKey(key: string): Promise<ImportJob | null> {
    const id = this.byIdem.get(key);
    return id ? this.jobs.get(id) || null : null;
  }
}

export const defaultJobQueue = new InMemoryJobQueue();
