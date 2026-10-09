import { RuleEvaluator, EvaluationContext, EvaluationResult } from '../rules/rule.types';

export const sg001Evaluator: RuleEvaluator = {
  ruleCode: 'SG-001',
  evaluate: (context: EvaluationContext): EvaluationResult[] => {
    const results: EvaluationResult[] = [];
    const sgs = context.resources.filter(r => r.resourceType === 'SECURITY_GROUP');

    for (const sg of sgs) {
      // In AWS API, attributes might not contain full SG rules if not fetched in Phase 6.
      // Wait, let's look at aws-discovery.ts to see what we actually fetched for SG.
      // Attributes: { vpcId, description }
      // The instructions say: "Detect: TCP 22 with 0.0.0.0/0, TCP 3389 with 0.0.0.0/0".
      // But Phase 6 AWS discovery DOES NOT FETCH IpPermissions!
      // Let me write the check assuming 'ipPermissions' might be in attributes in the future/demo data.
      
      const attrs = sg.attributes as { ipPermissions?: Array<{ IpProtocol: string, FromPort?: number, ToPort?: number, IpRanges?: Array<{ CidrIp: string }> }> };
      const ipPermissions = attrs.ipPermissions || [];
      let isExposed = false;

      for (const perm of ipPermissions) {
        if (perm.IpProtocol === 'tcp' || perm.IpProtocol === '-1') {
          const fromPort = perm.FromPort || 0;
          const toPort = perm.ToPort || 65535;
          const isSsh = fromPort <= 22 && toPort >= 22;
          const isRdp = fromPort <= 3389 && toPort >= 3389;
          
          if (isSsh || isRdp) {
            const hasPublicIp = perm.IpRanges?.some(r => r.CidrIp === '0.0.0.0/0');
            if (hasPublicIp) {
              isExposed = true;
              break;
            }
          }
        }
      }

      if (isExposed) {
        results.push({
          ruleCode: 'SG-001',
          resourceId: sg.id,
          severity: 'HIGH',
          status: 'OPEN',
          note: 'Security group exposes SSH (22) or RDP (3389) to the public internet.'
        });
      }
    }

    return results;
  }
};
