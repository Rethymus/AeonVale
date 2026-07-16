export interface PublicContentAuditFinding {
 path: string;
 line: number;
 kind: string;
 severity: string;
 reviewStatus: 'actionable' | 'reviewed-guardrail';
 match: string;
}

export interface PublicContentAuditReport {
 counts: {
 filesScanned: number;
 findings: number;
 high: number;
 info: number;
 actionable: number;
 reviewedGuardrail: number;
 byKind: Record<string, number>;
 };
 findings: PublicContentAuditFinding[];
}

export function auditPublicContentFiles(files: Array<{ path: string; content: string }>): PublicContentAuditReport;

export function auditPublicContentFromWorktree(): PublicContentAuditReport;

export function shouldFailPublicContentAudit(
 report: PublicContentAuditReport,
 options?: { failOnHighRisk?: boolean },
): boolean;
