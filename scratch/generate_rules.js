const fs = require('fs');
const path = require('path');

const rules = [
  {
    ruleCode: "S3-002",
    name: "S3 Bucket Encryption Disabled",
    category: "Storage",
    severity: "MEDIUM",
    description: "S3 bucket has no server-side encryption.",
    enabled: true
  },
  {
    ruleCode: "IAM-001",
    name: "IAM User No MFA",
    category: "IAM",
    severity: "HIGH",
    description: "IAM user has no MFA enabled.",
    enabled: true
  },
  {
    ruleCode: "IAM-002",
    name: "Stale IAM Access Key",
    category: "IAM",
    severity: "MEDIUM",
    description: "IAM access key is older than 90 days or unused for 90 days.",
    enabled: true
  },
  {
    ruleCode: "IAM-003",
    name: "Overly Permissive IAM Policy",
    category: "IAM",
    severity: "HIGH",
    description: "IAM policy grants administrator-level permissions.",
    enabled: true
  },
  {
    ruleCode: "RDS-001",
    name: "Public RDS Instance",
    category: "Database",
    severity: "HIGH",
    description: "RDS instance is publicly accessible.",
    enabled: true
  },
  {
    ruleCode: "RDS-002",
    name: "RDS Encryption Disabled",
    category: "Database",
    severity: "MEDIUM",
    description: "RDS encryption is disabled.",
    enabled: true
  },
  {
    ruleCode: "EC2-001",
    name: "Public EC2 Instance Unprotected",
    category: "Compute",
    severity: "MEDIUM",
    description: "EC2 instance has a public IP and lacks an identified protective WAF/load-balancer relationship.",
    enabled: true
  },
  {
    ruleCode: "LAMBDA-001",
    name: "Overly Permissive Lambda Role",
    category: "Compute",
    severity: "MEDIUM",
    description: "Lambda function uses an overly permissive IAM execution role.",
    enabled: true
  }
];

const dir = path.join(__dirname, '../src/modules/security/rules/definitions');

for (const rule of rules) {
  const yaml = `ruleCode: "${rule.ruleCode}"
name: "${rule.name}"
category: "${rule.category}"
severity: "${rule.severity}"
description: "${rule.description}"
enabled: ${rule.enabled}
`;
  fs.writeFileSync(path.join(dir, `${rule.ruleCode}.yaml`), yaml);
}
console.log("YAML rules created.");
