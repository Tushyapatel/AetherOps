export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FindingStatus = 'OPEN' | 'RESOLVED';

export interface SecurityRule {
  ruleCode: string;
  name: string;
  category: string;
  severity: Severity;
  description: string;
  remediationTemplate?: string;
  enabled: boolean;
}

export interface EvaluationResult {
  ruleCode: string;
  resourceId: number; // The internal integer ID of the resource
  severity: Severity;
  status: FindingStatus;
  note?: string;
}

export interface DbResource {
  id: number;
  accountId: number;
  resourceType: string;
  resourceId: string;
  arn: string | null;
  name: string | null;
  region: string | null;
  status: string | null;
  attributes: Record<string, unknown>;
}

export interface DbRelationship {
  id: number;
  accountId: number;
  resourceAId: number;
  resourceBId: number;
  relationType: string;
}

export interface EvaluationContext {
  resources: DbResource[];
  relationships: DbRelationship[];
}

export interface RuleEvaluator {
  ruleCode: string;
  evaluate: (context: EvaluationContext) => EvaluationResult[];
}
