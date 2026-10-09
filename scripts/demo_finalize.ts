/**
 * demo_finalize.ts
 * 
 * Calculates and persists:
 * 1. Risk scores (per account + project level) from real findings evidence
 * 2. Risk history snapshots
 * 3. Recommendations linked to actual findings
 * 4. Demo/simulated cost records (clearly labeled)
 * 
 * All values are deterministic from actual findings data.
 * Demo costs are synthetic and labeled as SIMULATED BILLING.
 */
import { getPool } from '../src/database';

// Severity weights for risk scoring
const SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 30,
  HIGH: 20,
  MEDIUM: 10,
  LOW: 5,
};

// Risk score is out of 100. Higher = worse (more risk).
// We cap at 100.
function calculateSecurityScore(findings: any[]): number {
  const openFindings = findings.filter(f => f.status === 'OPEN');
  if (openFindings.length === 0) return 0; // 0 = no risk = best score
  
  const rawPenalty = openFindings.reduce((sum: number, f: any) => {
    return sum + (SEVERITY_WEIGHTS[f.severity] || 5);
  }, 0);
  
  return Math.min(100, rawPenalty);
}

// Recommendation templates per rule
const RECOMMENDATIONS: Record<string, { title: string; description: string; steps: string; priority: string; effort: string }> = {
  'S3-001': {
    title: 'Restrict Public Access to S3 Bucket',
    description: 'This S3 bucket is publicly accessible. Unauthorized users can read or modify your data.',
    steps: '1. Navigate to S3 Console\n2. Select the bucket\n3. Go to Permissions > Block Public Access\n4. Enable all Block Public Access settings\n5. Review bucket ACLs and policies to remove public grants',
    priority: 'HIGH',
    effort: 'Low (30 minutes)',
  },
  'S3-002': {
    title: 'Enable Server-Side Encryption on S3 Bucket',
    description: 'This S3 bucket does not have server-side encryption enabled. Data at rest is unencrypted.',
    steps: '1. Navigate to S3 Console\n2. Select the bucket\n3. Go to Properties > Default Encryption\n4. Enable SSE-S3 or SSE-KMS encryption\n5. Optionally set a KMS key for fine-grained access control',
    priority: 'MEDIUM',
    effort: 'Low (15 minutes)',
  },
  'RDS-001': {
    title: 'Remove Public Accessibility from RDS Instance',
    description: 'The RDS database instance is publicly accessible over the internet.',
    steps: '1. Open RDS Console\n2. Select the instance\n3. Click Modify\n4. Set "Publicly Accessible" to No\n5. Review Security Group rules to restrict ingress to application subnets only',
    priority: 'HIGH',
    effort: 'Medium (1 hour)',
  },
  'RDS-002': {
    title: 'Enable Encryption at Rest for RDS Instance',
    description: 'RDS storage encryption is disabled. Database data is stored unencrypted.',
    steps: '1. Create a new encrypted snapshot of the DB instance\n2. Restore the encrypted snapshot as a new instance\n3. Update application connection strings\n4. Terminate the unencrypted instance\n5. Note: Encryption cannot be enabled on an existing instance — migration is required',
    priority: 'MEDIUM',
    effort: 'High (4–8 hours)',
  },
  'SG-001': {
    title: 'Restrict SSH/RDP Access in Security Group',
    description: 'This security group allows SSH (port 22) or RDP (port 3389) access from the public internet (0.0.0.0/0).',
    steps: '1. Navigate to EC2 Console > Security Groups\n2. Select the security group\n3. Edit Inbound Rules\n4. Remove or restrict the 0.0.0.0/0 rule for port 22/3389\n5. Replace with specific IP ranges or use a VPN/Bastion host',
    priority: 'HIGH',
    effort: 'Low (20 minutes)',
  },
  'IAM-001': {
    title: 'Enable MFA for IAM User',
    description: 'This IAM user does not have Multi-Factor Authentication (MFA) enabled.',
    steps: '1. Navigate to IAM Console > Users\n2. Select the user\n3. Go to the Security credentials tab\n4. Click Assign MFA device\n5. Follow setup for a virtual or hardware MFA device',
    priority: 'HIGH',
    effort: 'Low (10 minutes)',
  },
  'IAM-002': {
    title: 'Rotate or Remove Old IAM Access Key',
    description: 'This IAM access key is older than 90 days or has not been used for 90 days.',
    steps: '1. Navigate to IAM Console > Users > Security Credentials\n2. Create a new access key\n3. Update application/service configurations with the new key\n4. Test that services work with the new key\n5. Deactivate and delete the old key',
    priority: 'MEDIUM',
    effort: 'Medium (2 hours)',
  },
  'IAM-003': {
    title: 'Remove Administrator-Level IAM Policy',
    description: 'This IAM policy grants Action=* on Resource=*, effectively granting full admin access.',
    steps: '1. Identify all IAM principals (users, roles) attached to this policy\n2. Create scoped replacement policies using IAM least-privilege principles\n3. Attach the scoped policies and detach the overly permissive one\n4. Monitor CloudTrail for unexpected access denials after the change',
    priority: 'HIGH',
    effort: 'High (4+ hours)',
  },
  'LAMBDA-001': {
    title: 'Restrict Lambda Execution Role Permissions',
    description: 'The Lambda function uses an IAM role with overly broad permissions.',
    steps: '1. Identify the Lambda execution role in IAM Console\n2. Review attached policies and remove wildcard permissions\n3. Apply least-privilege — grant only required service and resource access\n4. Test Lambda function execution after policy updates',
    priority: 'HIGH',
    effort: 'Medium (2 hours)',
  },
};

// Demo simulated billing amounts per scenario (USD/month, representative, labeled as SIMULATED)
const DEMO_COSTS: Record<number, { service: string; amount: number }[]> = {
  1: [ // Secure Production - well-managed costs
    { service: 'AmazonEC2', amount: 520.00 },
    { service: 'AmazonS3', amount: 48.00 },
    { service: 'AmazonRDS', amount: 210.00 },
    { service: 'AWSLambda', amount: 12.00 },
    { service: 'AWSCLOUDTRAIL', amount: 5.00 },
  ],
  2: [ // Public Exposure - inefficient, no cost optimization
    { service: 'AmazonEC2', amount: 1200.00 },
    { service: 'AmazonS3', amount: 380.00 },
    { service: 'AmazonRDS', amount: 560.00 },
    { service: 'AWSLambda', amount: 45.00 },
  ],
  3: [ // IAM Privilege Risk - moderate costs
    { service: 'AmazonEC2', amount: 640.00 },
    { service: 'AmazonS3', amount: 95.00 },
    { service: 'AmazonRDS', amount: 290.00 },
    { service: 'AWSIAM', amount: 0.00 },
  ],
  4: [ // Cost Optimization Risk - high spend, underutilized
    { service: 'AmazonEC2', amount: 2100.00 },
    { service: 'AmazonS3', amount: 310.00 },
    { service: 'AmazonRDS', amount: 890.00 },
    { service: 'AWSLambda', amount: 8.00 },
  ],
  5: [ // Encryption Risk
    { service: 'AmazonEC2', amount: 480.00 },
    { service: 'AmazonS3', amount: 75.00 },
    { service: 'AmazonRDS', amount: 320.00 },
    { service: 'AWSKMS', amount: 15.00 },
  ],
  6: [ // Logging & Monitoring Failure
    { service: 'AmazonEC2', amount: 410.00 },
    { service: 'AmazonS3', amount: 55.00 },
    { service: 'AmazonCloudWatch', amount: 2.00 },
    { service: 'AWSCLOUDTRAIL', amount: 1.00 },
  ],
  7: [ // Network Segmentation Risk
    { service: 'AmazonEC2', amount: 780.00 },
    { service: 'AmazonVPC', amount: 35.00 },
    { service: 'AmazonS3', amount: 110.00 },
    { service: 'AWSDirectConnect', amount: 240.00 },
  ],
  8: [ // Backup & DR Risk
    { service: 'AmazonEC2', amount: 590.00 },
    { service: 'AmazonS3', amount: 145.00 },
    { service: 'AWSBackup', amount: 3.00 },
    { service: 'AmazonRDS', amount: 420.00 },
  ],
  9: [ // Serverless & Lambda Security Risk
    { service: 'AWSLambda', amount: 180.00 },
    { service: 'AmazonAPIGateway', amount: 95.00 },
    { service: 'AmazonS3', amount: 25.00 },
    { service: 'AmazonDynamoDB', amount: 40.00 },
  ],
  10: [ // Enterprise Critical Risk - high spend
    { service: 'AmazonEC2', amount: 3200.00 },
    { service: 'AmazonS3', amount: 480.00 },
    { service: 'AmazonRDS', amount: 1100.00 },
    { service: 'AWSLambda', amount: 95.00 },
    { service: 'AWSShield', amount: 3000.00 },
    { service: 'AWSCLOUDTRAIL', amount: 12.00 },
  ],
};

async function finalize() {
  const pool = getPool();
  try {
    // Get accounts
    const accountsRes = await pool.query('SELECT id, project_id FROM cloud_accounts ORDER BY id');
    const accounts = accountsRes.rows;
    
    console.log('=== Step 1: Calculate Risk Scores ===');
    const recordedAt = new Date();

    for (const acc of accounts) {
      // Get latest analysis run
      const runRes = await pool.query(
        'SELECT id FROM analysis_runs WHERE account_id = $1 ORDER BY started_at DESC LIMIT 1',
        [acc.id]
      );
      if (runRes.rows.length === 0) continue;
      const runId = runRes.rows[0].id;
      
      // Get findings
      const findingsRes = await pool.query(
        'SELECT severity, status FROM findings WHERE account_id = $1 AND analysis_run_id = $2',
        [acc.id, runId]
      );
      const findings = findingsRes.rows;
      
      const securityScore = calculateSecurityScore(findings);
      const highCount = findings.filter(f => f.severity === 'HIGH' || f.severity === 'CRITICAL').length;
      const reliabilityScore = Math.min(100, highCount * 15); // reliability degrades with HIGH findings
      const costScore = 0; // No real utilization data
      const complianceScore = Math.min(100, securityScore * 0.8); // compliance correlates with security
      const overallScore = Math.round((securityScore * 0.5 + reliabilityScore * 0.3 + complianceScore * 0.2));
      
      // Check if we already processed this exact analysis run
      const existingRes = await pool.query(
        'SELECT id FROM risk_scores WHERE account_id = $1 AND analysis_run_id = $2',
        [acc.id, runId]
      );
      const isNewRun = existingRes.rows.length === 0;

      // Upsert risk_scores: ensure only the latest score exists for this account
      await pool.query('DELETE FROM risk_scores WHERE account_id = $1', [acc.id]);
      
      await pool.query(`
        INSERT INTO risk_scores (project_id, account_id, analysis_run_id, security_score, cost_score, reliability_score, compliance_score, overall_score, calculated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [acc.project_id, acc.id, runId, securityScore, costScore, reliabilityScore, complianceScore, overallScore, recordedAt]);
      
      // Insert risk_history only if it's a genuinely new analysis run
      if (isNewRun) {
        await pool.query(`
          INSERT INTO risk_history (project_id, account_id, security_score, cost_score, reliability_score, compliance_score, overall_score, recorded_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [acc.project_id, acc.id, securityScore, costScore, reliabilityScore, complianceScore, overallScore, recordedAt]);
      }
      
      console.log(`  Account ${acc.id}: security=${securityScore} reliability=${reliabilityScore} overall=${overallScore} (from ${findings.length} findings)`);
    }
    
    // Project-level risk: aggregate
    const projectRes = await pool.query('SELECT id FROM projects LIMIT 1');
    const projectId = projectRes.rows[0].id;
    const allRiskRes = await pool.query(
      'SELECT AVG(security_score) s, AVG(cost_score) c, AVG(reliability_score) r, AVG(compliance_score) cm, AVG(overall_score) o FROM risk_scores WHERE project_id = $1',
      [projectId]
    );
    const avg = allRiskRes.rows[0];
    // Skip project-level insert — dashboard aggregates from per-account rows
    console.log(`  Project overall (avg across accounts): security=${Math.round(avg.s||0)} overall=${Math.round(avg.o||0)}`);
    
    console.log('\n=== Step 2: Create Recommendations ===');
    const findingsRes2 = await pool.query('SELECT id, rule_id, account_id FROM findings ORDER BY id');
    for (const finding of findingsRes2.rows) {
      const template = RECOMMENDATIONS[finding.rule_id];
      if (!template) continue;
      
      // Check not already exists
      const existsRes = await pool.query('SELECT 1 FROM recommendations WHERE finding_id = $1', [finding.id]);
      if (existsRes.rows.length > 0) continue;
      
      await pool.query(`
        INSERT INTO recommendations (finding_id, title, description, remediation_steps, priority, estimated_effort, automation_available, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
      `, [finding.id, template.title, template.description, template.steps, template.priority, template.effort]);
    }
    const recCount = await pool.query('SELECT count(*) FROM recommendations');
    console.log(`  Created ${recCount.rows[0].count} recommendations`);
    
    console.log('\n=== Step 3: Insert Simulated Demo Costs ===');
    await pool.query('DELETE FROM costs WHERE metric = $1', ['SIMULATED_BILLING']);
    
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    for (const acc of accounts) {
      const costList = DEMO_COSTS[acc.id] || [];
      for (const cost of costList) {
        await pool.query(`
          INSERT INTO costs (account_id, service_name, period_start, period_end, amount, currency, granularity, metric)
          VALUES ($1, $2, $3, $4, $5, 'USD', 'MONTHLY', 'SIMULATED_BILLING')
        `, [acc.id, cost.service, periodStart, periodEnd, cost.amount]);
      }
    }
    const costCount = await pool.query('SELECT count(*) FROM costs');
    console.log(`  Inserted ${costCount.rows[0].count} simulated cost records`);
    
    console.log('\n=== Final Database Counts ===');
    for (const tbl of ['analysis_runs', 'findings', 'risk_scores', 'risk_history', 'attack_paths', 'recommendations', 'costs']) {
      const res = await pool.query(`SELECT count(*) FROM ${tbl}`);
      console.log(`  ${tbl}: ${res.rows[0].count}`);
    }
    
    console.log('\nDemo finalization complete!');
  } finally {
    await pool.end();
  }
}

finalize();
