mock_resources = [
    # Security groups
    {
        "id": "sg-001",
        "resource_type": "security_group",
        "inbound_rules": [{"source": "0.0.0.0/0", "port": 22}]
    },
    {
        "id": "sg-002",
        "resource_type": "security_group",
        "inbound_rules": [{"source": "10.0.0.0/16", "port": 22}]
    },

    # S3 buckets
    {"id": "s3-001", "resource_type": "s3_bucket", "public_read": True},
    {"id": "s3-002", "resource_type": "s3_bucket", "public_read": False},

    # IAM users
    {"id": "user-001", "resource_type": "iam_user", "mfa_enabled": False, "is_root": False},
    {"id": "user-002", "resource_type": "iam_user", "mfa_enabled": True, "is_root": False},
    {"id": "root-001", "resource_type": "iam_user", "mfa_enabled": True, "is_root": True},

    # IAM access keys
    {"id": "key-001", "resource_type": "iam_access_key", "age_days": 120},
    {"id": "key-002", "resource_type": "iam_access_key", "age_days": 15},

    # RDS instances
    {"id": "rds-001", "resource_type": "rds_instance", "publicly_accessible": True, "storage_encrypted": True},
    {"id": "rds-002", "resource_type": "rds_instance", "publicly_accessible": False, "storage_encrypted": False},
    {"id": "rds-003", "resource_type": "rds_instance", "publicly_accessible": False, "storage_encrypted": True},

    # IAM policies
    {"id": "policy-001", "resource_type": "iam_policy", "action": "*"},
    {"id": "policy-002", "resource_type": "iam_policy", "action": "s3:GetObject"},
]