export interface PublicWorktreeAuditReport {
  counts: Record<string, number>;
  byClass: Record<string, string[]>;
  publicCandidateGroupCounts: Record<string, number>;
  publicCandidatesByGroup: Record<string, string[]>;
}

export function classifyPublicCandidateGroup(path: string): string;

export function auditPublicWorktree(statusOutput: string): PublicWorktreeAuditReport;

export function shouldFailPublicWorktreeAudit(report: PublicWorktreeAuditReport, options?: { failOnPublicCandidates?: boolean; failOnSecretRisk?: boolean }): boolean;
