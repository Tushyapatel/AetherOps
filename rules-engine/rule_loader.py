import yaml
import os

RULES_FOLDER = os.path.join(os.path.dirname(__file__), "rules")

def load_rules():
    """Reads every .yaml file in the rules/ folder and returns them as a list of dicts."""
    rules = []
    for filename in os.listdir(RULES_FOLDER):
        if filename.endswith(".yaml") or filename.endswith(".yml"):
            filepath = os.path.join(RULES_FOLDER, filename)
            with open(filepath, "r") as f:
                rule = yaml.safe_load(f)
                rules.append(rule)
    return rules