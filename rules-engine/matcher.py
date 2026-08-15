def get_field(resource, field_path):
    """Digs into a resource to get a field's value, handling dot notation like 'a.b'."""
    parts = field_path.split(".")
    value = resource
    for part in parts:
        if isinstance(value, dict):
            value = value.get(part)
        else:
            return None
    return value


def check_condition(resource, condition):
    """Checks if a resource matches a rule's condition. Handles multiple condition types."""

    # Special case: security-group-style checks with a list of inbound rules
    if "port_in" in condition:
        for rule in resource.get("inbound_rules", []):
            if rule.get("source") == condition.get("equals") and rule.get("port") in condition["port_in"]:
                return True
        return False

    field_value = get_field(resource, condition["field"])

    if "equals" in condition:
        return field_value == condition["equals"]

    if "greater_than" in condition:
        if field_value is None:
            return False
        return field_value > condition["greater_than"]

    return False


def run_rules(resources, rules):
    """Checks every resource against every applicable rule, returns a list of findings."""
    findings = []
    for rule in rules:
        matching_resources = [r for r in resources if r["resource_type"] == rule["resource_type"]]
        for resource in matching_resources:
            if check_condition(resource, rule["condition"]):
                findings.append({
                    "resource_id": resource["id"],
                    "rule_id": rule["id"],
                    "title": rule["title"],
                    "severity": rule["severity"],
                    "explanation": rule["explanation"]
                })
    return findings