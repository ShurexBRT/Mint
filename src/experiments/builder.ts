export interface BuilderJob { id: string; opportunityId: string; specification: string; status: 'DISABLED'; createdAt: string }
export interface Builder { execute(job: BuilderJob): Promise<{ status: 'DISABLED'; reason: string }> }
export class DisabledBuilder implements Builder {
  async execute(_job: BuilderJob): Promise<{ status: 'DISABLED'; reason: string }> {
    void _job;
    return { status: 'DISABLED', reason: 'Phase 1 never builds or deploys arbitrary applications.' };
  }
}
