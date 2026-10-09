import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getPool } from '../../../database';
import { SecurityRule } from './rule.types';
import { logger } from '../../../logger';

const RULES_DIR = path.join(__dirname, 'definitions');

export function loadRulesFromYaml(): SecurityRule[] {
  const rules: SecurityRule[] = [];
  if (!fs.existsSync(RULES_DIR)) {
    logger.warn(`Rules directory not found: ${RULES_DIR}`);
    return rules;
  }

  const files = fs.readdirSync(RULES_DIR);
  for (const file of files) {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      try {
        const content = fs.readFileSync(path.join(RULES_DIR, file), 'utf8');
        const parsed = yaml.load(content) as Record<string, unknown> | null | undefined;
        if (parsed && typeof parsed.ruleCode === 'string' && typeof parsed.name === 'string') {
          rules.push({
            ruleCode: parsed.ruleCode,
            name: parsed.name,
            category: typeof parsed.category === 'string' ? parsed.category : 'General',
            severity: typeof parsed.severity === 'string' ? (parsed.severity as 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL') : 'LOW',
            description: typeof parsed.description === 'string' ? parsed.description : '',
            remediationTemplate: typeof parsed.remediationTemplate === 'string' ? parsed.remediationTemplate : undefined,
            enabled: parsed.enabled !== false,
          });
        }
      } catch (err: unknown) {
        logger.error(`Failed to parse rule file ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return rules;
}

export async function syncRulesToDb(): Promise<void> {
  const rules = loadRulesFromYaml();
  const pool = getPool();

  for (const rule of rules) {
    await pool.query(
      `INSERT INTO finding_rules (
         rule_code, name, category, severity, description, remediation_template, enabled
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (rule_code) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         severity = EXCLUDED.severity,
         description = EXCLUDED.description,
         remediation_template = EXCLUDED.remediation_template,
         enabled = EXCLUDED.enabled`,
      [
        rule.ruleCode,
        rule.name,
        rule.category,
        rule.severity,
        rule.description,
        rule.remediationTemplate || null,
        rule.enabled
      ]
    );
  }
  logger.info(`Synchronized ${rules.length} security rules to database.`);
}
