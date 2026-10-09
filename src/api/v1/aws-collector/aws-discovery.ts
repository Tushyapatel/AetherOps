import { 
  EC2Client, 
  paginateDescribeInstances,
  paginateDescribeVpcs,
  paginateDescribeSubnets,
  paginateDescribeSecurityGroups
} from '@aws-sdk/client-ec2';

import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';

import { 
  IAMClient, 
  paginateListRoles 
} from '@aws-sdk/client-iam';

import { 
  RDSClient, 
  paginateDescribeDBInstances 
} from '@aws-sdk/client-rds';

import { 
  LambdaClient, 
  paginateListFunctions 
} from '@aws-sdk/client-lambda';

export interface AwsResource {
  resourceType: string;
  resourceId: string;
  arn: string | null;
  name: string | null;
  region: string | null;
  status: string | null;
  attributes: any;
}

export interface AwsRelationship {
  resourceAType: string;
  resourceAId: string;
  resourceBType: string;
  resourceBId: string;
  relationType: string;
}

export interface DiscoveryResult {
  resources: AwsResource[];
  relationships: AwsRelationship[];
  errors: string[];
}

export async function runAwsDiscovery(
  credentials: { accessKeyId: string, secretAccessKey: string, sessionToken?: string },
  region: string,
  accountId: string
): Promise<DiscoveryResult> {
  const resources: AwsResource[] = [];
  const relationships: AwsRelationship[] = [];
  const errors: string[] = [];

  const ec2Client = new EC2Client({ credentials, region });
  const s3Client = new S3Client({ credentials, region });
  const iamClient = new IAMClient({ credentials, region: 'us-east-1' }); // IAM is global
  const rdsClient = new RDSClient({ credentials, region });
  const lambdaClient = new LambdaClient({ credentials, region });

  // Helper to extract Name tag
  const getNameTag = (tags?: { Key?: string, Value?: string }[]) => {
    return tags?.find(t => t.Key === 'Name')?.Value || null;
  };

  // 1. EC2 VPCs
  try {
    for await (const page of paginateDescribeVpcs({ client: ec2Client }, {})) {
      if (!page.Vpcs) continue;
      for (const vpc of page.Vpcs) {
        if (!vpc.VpcId) continue;
        const name = getNameTag(vpc.Tags);
        resources.push({
          resourceType: 'VPC',
          resourceId: vpc.VpcId,
          arn: `arn:aws:ec2:${region}:${accountId}:vpc/${vpc.VpcId}`,
          name,
          region,
          status: vpc.State || 'available',
          attributes: { cidr: vpc.CidrBlock, isDefault: vpc.IsDefault }
        });
      }
    }
  } catch (err: any) {
    errors.push(`VPC Discovery Error: ${err.message}`);
  }

  // 2. EC2 Subnets
  try {
    for await (const page of paginateDescribeSubnets({ client: ec2Client }, {})) {
      if (!page.Subnets) continue;
      for (const subnet of page.Subnets) {
        if (!subnet.SubnetId) continue;
        const name = getNameTag(subnet.Tags);
        resources.push({
          resourceType: 'SUBNET',
          resourceId: subnet.SubnetId,
          arn: `arn:aws:ec2:${region}:${accountId}:subnet/${subnet.SubnetId}`,
          name,
          region,
          status: subnet.State || 'available',
          attributes: { cidr: subnet.CidrBlock, vpcId: subnet.VpcId, az: subnet.AvailabilityZone }
        });

        if (subnet.VpcId) {
          relationships.push({
            resourceAType: 'VPC',
            resourceAId: subnet.VpcId,
            resourceBType: 'SUBNET',
            resourceBId: subnet.SubnetId,
            relationType: 'HAS_SUBNET'
          });
        }
      }
    }
  } catch (err: any) {
    errors.push(`Subnet Discovery Error: ${err.message}`);
  }

  // 3. EC2 Security Groups
  try {
    for await (const page of paginateDescribeSecurityGroups({ client: ec2Client }, {})) {
      if (!page.SecurityGroups) continue;
      for (const sg of page.SecurityGroups) {
        if (!sg.GroupId) continue;
        const name = sg.GroupName || getNameTag(sg.Tags) || null;
        resources.push({
          resourceType: 'SECURITY_GROUP',
          resourceId: sg.GroupId,
          arn: `arn:aws:ec2:${region}:${accountId}:security-group/${sg.GroupId}`,
          name,
          region,
          status: 'available',
          attributes: { vpcId: sg.VpcId, description: sg.Description }
        });

        if (sg.VpcId) {
          relationships.push({
            resourceAType: 'VPC',
            resourceAId: sg.VpcId,
            resourceBType: 'SECURITY_GROUP',
            resourceBId: sg.GroupId,
            relationType: 'HAS_SECURITY_GROUP'
          });
        }
      }
    }
  } catch (err: any) {
    errors.push(`Security Group Discovery Error: ${err.message}`);
  }

  // 4. EC2 Instances
  try {
    for await (const page of paginateDescribeInstances({ client: ec2Client }, {})) {
      if (!page.Reservations) continue;
      for (const reservation of page.Reservations) {
        if (!reservation.Instances) continue;
        for (const instance of reservation.Instances) {
          if (!instance.InstanceId) continue;
          const name = getNameTag(instance.Tags);
          resources.push({
            resourceType: 'EC2_INSTANCE',
            resourceId: instance.InstanceId,
            arn: `arn:aws:ec2:${region}:${accountId}:instance/${instance.InstanceId}`,
            name,
            region,
            status: instance.State?.Name || 'unknown',
            attributes: {
              instanceType: instance.InstanceType,
              vpcId: instance.VpcId,
              subnetId: instance.SubnetId,
              privateIp: instance.PrivateIpAddress,
              publicIp: instance.PublicIpAddress
            }
          });

          if (instance.SubnetId) {
            relationships.push({
              resourceAType: 'SUBNET',
              resourceAId: instance.SubnetId,
              resourceBType: 'EC2_INSTANCE',
              resourceBId: instance.InstanceId,
              relationType: 'CONTAINS_INSTANCE'
            });
          }

          if (instance.SecurityGroups) {
            for (const sg of instance.SecurityGroups) {
              if (sg.GroupId) {
                relationships.push({
                  resourceAType: 'EC2_INSTANCE',
                  resourceAId: instance.InstanceId,
                  resourceBType: 'SECURITY_GROUP',
                  resourceBId: sg.GroupId,
                  relationType: 'ATTACHED_TO'
                });
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    errors.push(`EC2 Instance Discovery Error: ${err.message}`);
  }

  // 5. S3 Buckets (no paginator for ListBuckets)
  try {
    const listBucketsResponse = await s3Client.send(new ListBucketsCommand({}));
    if (listBucketsResponse.Buckets) {
      for (const bucket of listBucketsResponse.Buckets) {
        if (!bucket.Name) continue;
        let bucketRegion = 'global';
        try {
          const loc = await s3Client.send(new GetBucketLocationCommand({ Bucket: bucket.Name }));
          // AWS returns empty string or undefined for us-east-1, otherwise it returns the region like 'eu-west-1'
          bucketRegion = loc.LocationConstraint || 'us-east-1';
        } catch (locErr: any) {
          errors.push(`Could not fetch region for bucket ${bucket.Name}: ${locErr.message}`);
        }

        resources.push({
          resourceType: 'S3_BUCKET',
          resourceId: bucket.Name,
          arn: `arn:aws:s3:::${bucket.Name}`,
          name: bucket.Name,
          region: bucketRegion,
          status: 'available',
          attributes: { creationDate: bucket.CreationDate }
        });
      }
    }
  } catch (err: any) {
    errors.push(`S3 Discovery Error: ${err.message}`);
  }

  // 6. IAM Roles
  try {
    for await (const page of paginateListRoles({ client: iamClient }, {})) {
      if (!page.Roles) continue;
      for (const role of page.Roles) {
        if (!role.RoleId) continue;
        resources.push({
          resourceType: 'IAM_ROLE',
          resourceId: role.RoleId,
          arn: role.Arn || null,
          name: role.RoleName || null,
          region: 'global',
          status: 'available',
          attributes: { path: role.Path, createDate: role.CreateDate }
        });
      }
    }
  } catch (err: any) {
    errors.push(`IAM Role Discovery Error: ${err.message}`);
  }

  // 7. RDS Instances
  try {
    for await (const page of paginateDescribeDBInstances({ client: rdsClient }, {})) {
      if (!page.DBInstances) continue;
      for (const db of page.DBInstances) {
        if (!db.DBInstanceIdentifier) continue;
        resources.push({
          resourceType: 'RDS_INSTANCE',
          resourceId: db.DBInstanceIdentifier,
          arn: db.DBInstanceArn || null,
          name: db.DBInstanceIdentifier,
          region,
          status: db.DBInstanceStatus || 'unknown',
          attributes: { engine: db.Engine, engineVersion: db.EngineVersion, class: db.DBInstanceClass }
        });
        
        if (db.DBSubnetGroup && db.DBSubnetGroup.VpcId) {
          relationships.push({
            resourceAType: 'VPC',
            resourceAId: db.DBSubnetGroup.VpcId,
            resourceBType: 'RDS_INSTANCE',
            resourceBId: db.DBInstanceIdentifier,
            relationType: 'CONTAINS_DB'
          });
        }
      }
    }
  } catch (err: any) {
    errors.push(`RDS Discovery Error: ${err.message}`);
  }

  // 8. Lambda Functions
  try {
    for await (const page of paginateListFunctions({ client: lambdaClient }, {})) {
      if (!page.Functions) continue;
      for (const fn of page.Functions) {
        if (!fn.FunctionName) continue;
        resources.push({
          resourceType: 'LAMBDA_FUNCTION',
          resourceId: fn.FunctionName,
          arn: fn.FunctionArn || null,
          name: fn.FunctionName,
          region,
          status: 'available',
          attributes: { runtime: fn.Runtime, handler: fn.Handler, role: fn.Role }
        });
        
        if (fn.Role) {
          // Extract role ID or name from ARN? Just use the full ARN to link if we don't have the internal ID.
          // Since IAM_ROLE resourceId is the AWS RoleId, and here we have Role ARN, it's tricky to link exactly by ID.
          // We can link by ARN if we want, but our relation table expects internal IDs. We will handle linking in the persistence layer.
          relationships.push({
            resourceAType: 'LAMBDA_FUNCTION',
            resourceAId: fn.FunctionName,
            resourceBType: 'IAM_ROLE',
            resourceBId: fn.Role, // Pass the ARN, the orchestrator will resolve it
            relationType: 'ASSUMES_ROLE'
          });
        }
      }
    }
  } catch (err: any) {
    errors.push(`Lambda Discovery Error: ${err.message}`);
  }

  return { resources, relationships, errors };
}
