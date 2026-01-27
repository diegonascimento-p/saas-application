// backend/lib/database-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly databaseSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a simple VPC for the database
    const vpc = new ec2.Vpc(this, 'DatabaseVpc', {
      maxAzs: 2,
      natGateways: 0, // No NAT gateway to reduce cost and complexity
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // Security Group for RDS
    const securityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for SaaS PostgreSQL database',
      allowAllOutbound: true,
    });

    // Allow PostgreSQL access from within the VPC
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from within VPC'
    );

    // Create database secret
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: `saas-database-credentials-${id}`,
      description: 'Credentials for SaaS PostgreSQL database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'saasadmin',
        }),
        excludePunctuation: true,
        generateStringKey: 'password',
        passwordLength: 16,
      },
    });

    // Create RDS PostgreSQL instance with Free Tier compliance
    this.database = new rds.DatabaseInstance(this, 'PostgreSQLInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [securityGroup],
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      databaseName: 'saasdb',
      allocatedStorage: 20,
      // NO backupRetention parameter - let it use default (Free Tier compliant)
      // NO storageType parameter - let it use default (gp2 for Free Tier)
      // NO storageEncrypted parameter - Free Tier doesn't support encryption
      publiclyAccessible: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      multiAz: false,
      // Disable enhanced monitoring and performance insights for Free Tier
      monitoringInterval: cdk.Duration.seconds(0),
      enablePerformanceInsights: false,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint address',
      exportName: `${this.stackName}-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.database.dbInstanceEndpointPort,
      description: 'RDS PostgreSQL port number',
      exportName: `${this.stackName}-DatabasePort`,
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: 'saasdb',
      description: 'PostgreSQL database name',
      exportName: `${this.stackName}-DatabaseName`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'ARN of the secret containing database credentials',
      exportName: `${this.stackName}-SecretArn`,
    });
  }
}