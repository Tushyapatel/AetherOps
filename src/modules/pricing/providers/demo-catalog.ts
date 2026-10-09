export const DemoCatalog = {
  AWS: {
    COMPUTE: {
      'us-east-1': { sku: 'aws-ec2-m7g.xlarge', productName: 'Amazon EC2 m7g.xlarge', unit: 'hour', rate: 0.1632 },
      'default': { sku: 'aws-ec2-generic', productName: 'Amazon EC2 generic', unit: 'hour', rate: 0.1000 }
    },
    OBJECT_STORAGE: {
      'default': { sku: 'aws-s3-standard', productName: 'Amazon S3 Standard', unit: 'GB-Mo', rate: 0.023 }
    },
    RELATIONAL_DATABASE: {
      'default': { sku: 'aws-rds-pg', productName: 'Amazon RDS PostgreSQL', unit: 'hour', rate: 0.25 }
    }
  },
  AZURE: {
    COMPUTE: {
      'eastus': { sku: 'azure-vm-b2s', productName: 'Standard_B2s', unit: '1 Hour', rate: 0.0416 },
      'default': { sku: 'azure-vm-generic', productName: 'Virtual Machine', unit: '1 Hour', rate: 0.1000 }
    },
    OBJECT_STORAGE: {
      'default': { sku: 'azure-blob-hot', productName: 'Blob Storage Hot', unit: '1 GB/Month', rate: 0.0184 }
    },
    RELATIONAL_DATABASE: {
      'default': { sku: 'azure-pg-flex', productName: 'Azure Database for PostgreSQL', unit: '1 Hour', rate: 0.178 }
    }
  },
  GCP: {
    COMPUTE: {
      'us-east4': { sku: 'gcp-compute-n1', productName: 'N1 Predefined Instance', unit: 'vCPU-second', rate: 0.000024 }, // Assuming CPU only for simplicity in demo
      'default': { sku: 'gcp-compute-generic', productName: 'Compute Engine', unit: 'hour', rate: 0.1000 }
    },
    OBJECT_STORAGE: {
      'default': { sku: 'gcp-storage-std', productName: 'Standard Storage', unit: 'GiB-hour', rate: 0.000027397 }
    },
    RELATIONAL_DATABASE: {
      'default': { sku: 'gcp-sql-pg', productName: 'Cloud SQL PostgreSQL', unit: 'vCPU-hour', rate: 0.0413 }
    }
  }
};
