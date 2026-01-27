// backend/lib/main.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as path from "path";
import { DatabaseStack } from "../lib/database-stack";

export class SaasBackendStack extends cdk.Stack {
  constructor(
    scope: Construct, 
    id: string, 
    databaseStack: DatabaseStack,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // S3 Bucket for images
    const imageBucket = new s3.Bucket(this, "SaasImagesBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // Cognito User Pool for authentication
    const userPool = new cognito.UserPool(this, "SaasUserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // User groups for role-based access control
    new cognito.CfnUserPoolGroup(this, "StandardGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "Standard",
      precedence: 1,
    });

    new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "Admin",
      precedence: 0,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "SaasUserPoolClient", {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // Lambda function to fetch data from PostgreSQL
    const dataLambda = new lambda.Function(this, "DataLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/lambda/data")),
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
        REGION: this.region,
        DB_SECRET_ARN: databaseStack.databaseSecret.secretArn,
        DB_ENDPOINT: databaseStack.database.dbInstanceEndpointAddress,
        DB_PORT: databaseStack.database.dbInstanceEndpointPort,
        DB_NAME: "saasdb",
        DB_REGION: this.region,
        USER_POOL_ID: userPool.userPoolId,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Lambda function to get signed URLs for S3 images
    // USANDO bundle que você criou
    const imagesLambda = new lambda.Function(this, "ImagesLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/lambda/images/bundle")),
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
        REGION: this.region,
        USER_POOL_ID: userPool.userPoolId,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Grant permissions to Lambda functions
    imageBucket.grantRead(imagesLambda);
    
    // Configure database access for dataLambda
    databaseStack.databaseSecret.grantRead(dataLambda);
    
    // Add database access policy manually
    dataLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
        'rds-db:connect',
      ],
      resources: [
        databaseStack.databaseSecret.secretArn,
        `arn:aws:rds-db:${this.region}:${this.account}:dbuser:*/saasadmin`,
      ],
    }));
    
    // Add policy to allow Lambda to access Cognito for user verification
    dataLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "cognito-idp:AdminGetUser",
        "cognito-idp:ListGroupsForUser",
      ],
      resources: [userPool.userPoolArn],
    }));

    imagesLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "cognito-idp:AdminGetUser",
      ],
      resources: [userPool.userPoolArn],
    }));

    // API Gateway with CORS configuration
    const api = new apigateway.RestApi(this, "SaasApi", {
      restApiName: "SaaS Platform API",
      description: "API for SaaS application with PostgreSQL backend",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date"],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: "prod",
      },
    });

    // Cognito authorizer for API Gateway
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
      cognitoUserPools: [userPool],
      authorizerName: "CognitoAuthorizer",
      identitySource: "method.request.header.Authorization",
    });

    // /data endpoint - retrieves user-specific data from PostgreSQL
    const dataResource = api.root.addResource("data");
    dataResource.addMethod("GET", new apigateway.LambdaIntegration(dataLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "401",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    });

    // /images endpoint - retrieves signed URLs for S3 images
    const imagesResource = api.root.addResource("images");
    imagesResource.addMethod("GET", new apigateway.LambdaIntegration(imagesLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "401",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    });

    // Outputs for easy reference
    new cdk.CfnOutput(this, "UserPoolId", { 
      value: userPool.userPoolId,
      description: "Cognito User Pool ID for authentication",
    });
    
    new cdk.CfnOutput(this, "UserPoolClientId", { 
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });
    
    new cdk.CfnOutput(this, "ApiEndpoint", { 
      value: api.url,
      description: "API Gateway endpoint URL",
    });
    
    new cdk.CfnOutput(this, "BucketName", { 
      value: imageBucket.bucketName,
      description: "S3 bucket name for storing images",
    });
    
    new cdk.CfnOutput(this, "Region", { 
      value: this.region,
      description: "AWS region where resources are deployed",
    });
    
    // New output for database endpoint
    new cdk.CfnOutput(this, "DatabaseEndpoint", { 
      value: databaseStack.database.dbInstanceEndpointAddress,
      description: "RDS PostgreSQL endpoint",
    });
  }
}

// Main application entry point
const app = new cdk.App();

// Database Stack - PostgreSQL RDS instance
const databaseStack = new DatabaseStack(app, "SaasDatabaseStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-2",
  },
  description: "PostgreSQL RDS database for SaaS application",
});

// Backend Stack - Cognito, S3, API Gateway, and Lambda functions
// Pass databaseStack as parameter
const backendStack = new SaasBackendStack(
  app, 
  "SaasBackendStack", 
  databaseStack,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || "us-east-2",
    },
    description: "Main backend infrastructure for SaaS application",
  }
);

// Add dependency - Database must be created before backend
backendStack.addDependency(databaseStack);

// Add tags for resource organization and cost tracking
cdk.Tags.of(app).add("Project", "SaaS-Application");
cdk.Tags.of(app).add("Environment", "Development");
cdk.Tags.of(app).add("ManagedBy", "AWS-CDK");
cdk.Tags.of(app).add("Owner", "DevelopmentTeam");