from rule_loader import load_rules
from matcher import run_rules
from mock_data import mock_resources

rules = load_rules()
findings = run_rules(mock_resources, rules)

print(f"Loaded {len(rules)} rules")
print(f"Found {len(findings)} findings:\n")
for f in findings:
    print(f"[{f['severity'].upper()}] {f['resource_id']} — {f['title']}")