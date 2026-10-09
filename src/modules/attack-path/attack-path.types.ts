export interface GraphFinding {
  id: number;
  ruleId: string;
  severity: string;
}

export interface GraphEdge {
  targetNodeId: number;
  relationType: string;
}

export interface GraphNode {
  dbId: number;
  resourceId: string;
  resourceType: string;
  findings: GraphFinding[];
  edges: GraphEdge[];
}

export interface AttackPath {
  id?: number;
  accountId: number;
  analysisRunId: number;
  pathHash: string;
  severity?: string;
  findingChain: Array<{
    resourceId: string;
    resourceType: string;
    findingIds: string[];
  }>;
  description?: string;
  createdAt?: Date;
}
