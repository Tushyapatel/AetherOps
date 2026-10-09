import { getProject } from '../projects/project.service';
import {
  getProjectFindings,
  getProjectResources,
  getProjectAttackPaths,
  getProjectRiskScores,
  getProjectCosts
} from '../dashboard/dashboard.repository';
import { ReportData } from './report.types';

export async function generateReportData(projectId: number, userId: number): Promise<ReportData> {
  // Validate ownership
  const project = await getProject(projectId.toString(), userId);

  const [findings, resources, attackPaths, riskScore, costs] = await Promise.all([
    getProjectFindings(projectId),
    getProjectResources(projectId),
    getProjectAttackPaths(projectId),
    getProjectRiskScores(projectId),
    getProjectCosts(projectId)
  ]);

  const limitations: string[] = [];

  const severityDistribution = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  };

  findings.forEach((f: any) => {
    if (f.status === 'OPEN' || f.status === 'ACTIVE') {
      const sev = (f.severity || 'INFO').toUpperCase();
      if (Object.prototype.hasOwnProperty.call(severityDistribution, sev)) {
        severityDistribution[sev as keyof typeof severityDistribution]++;
      } else {
        severityDistribution.INFO++;
      }
    }
  });

  const uniqueCloudAccounts = new Set(resources.map((r: any) => r.cloud_account_id));

  let aggregatedCosts = null;
  if (costs && costs.length > 0) {
    const hasSimulated = costs.some((c: any) => c.metric === 'SIMULATED_BILLING');
    const hasActual = costs.some((c: any) => c.metric !== 'SIMULATED_BILLING' && c.metric);
    const billingSource: 'MIXED' | 'SIMULATED_DEMO' | 'ACTUAL_AWS' = hasSimulated && hasActual ? 'MIXED'
      : hasSimulated ? 'SIMULATED_DEMO'
      : 'ACTUAL_AWS';

    aggregatedCosts = {
      totalSpend: costs.reduce((sum: number, c: any) => sum + Number(c.amount), 0),
      currency: costs[0].currency || 'USD',
      billingSource,
      services: costs.map((c: any) => ({ serviceName: c.service_name, amount: Number(c.amount) }))
    };
  } else {
    limitations.push('Billing data not available for this period.');
  }

  if (findings.length === 0) limitations.push('No findings currently recorded.');
  if (resources.length === 0) limitations.push('No resources discovered.');
  if (attackPaths.length === 0) limitations.push('No attack paths generated.');

  const reportData: ReportData = {
    metadata: {
      projectId,
      projectName: project.name,
      generatedAt: new Date().toISOString()
    },
    summary: {
      resourceCount: resources.length,
      cloudAccountCount: uniqueCloudAccounts.size,
      overallRiskScore: riskScore ? riskScore.overall_score : null,
      severityDistribution
    },
    findings: findings.map((f: any) => ({
      id: f.id,
      title: f.title,
      rule_code: f.rule_code,
      category: f.category,
      severity: f.severity,
      status: f.status,
      resource_name: f.resource_name || 'N/A',
      resource_type: f.resource_type || 'Unknown',
      description: f.description,
      recommendation: f.recommendation,
      cloud_account_name: f.cloud_account_name
    })),
    resources: resources.map((r: any) => ({
      id: r.id,
      name: r.name || r.resource_id,
      type: r.type,
      region: r.region,
      cloud_account_name: r.cloud_account_name
    })),
    attackPaths: attackPaths.map((ap: any) => ({
      id: ap.id,
      title: ap.title,
      description: ap.description,
      severity: ap.severity || 'HIGH',
      cloud_account_name: ap.cloud_account_name
    })),
    costs: aggregatedCosts,
    limitations
  };

  return reportData;
}
