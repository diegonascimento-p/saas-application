import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
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

    imageBucket.grantRead(imagesLambda);
    
    databaseStack.databaseSecret.grantRead(dataLambda);
    
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

    const api = new apigateway.RestApi(this, "SaasApi", {
      restApiName: "SaaS Platform API",
      description: "API for SaaS application with PostgreSQL backend",
      defaultCorsPreflightOptions: {
        allowOrigins: [
          "http://localhost:3000",
          "http://saas-frontend-20260127162301.s3-website.us-east-2.amazonaws.com"
        ],
        allowMethods: ["GET", "OPTIONS"],  // ← Especifique apenas os necessários
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Api-Key",
          "X-Amz-Security-Token"
        ],
        allowCredentials: true, 
      },
      deployOptions: {
        stageName: "prod",
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
      cognitoUserPools: [userPool],
      authorizerName: "CognitoAuthorizer",
      identitySource: "method.request.header.Authorization",
    });

    const dataResource = api.root.addResource("data");
    const imagesResource = api.root.addResource("images");

    dataResource.addMethod("GET", new apigateway.LambdaIntegration(dataLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizationScopes: undefined,
    });

    imagesResource.addMethod("GET", new apigateway.LambdaIntegration(imagesLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizationScopes: undefined,
    });

    new cdk.CfnOutput(this, "UserPoolId", { 
      value: userPool.userPoolId,
    });
    
    new cdk.CfnOutput(this, "UserPoolClientId", { 
      value: userPoolClient.userPoolClientId,
    });
    
    new cdk.CfnOutput(this, "ApiEndpoint", { 
      value: api.url,
    });
    
    new cdk.CfnOutput(this, "BucketName", { 
      value: imageBucket.bucketName,
    });
    
    new cdk.CfnOutput(this, "Region", { 
      value: this.region,
    });
    
    new cdk.CfnOutput(this, "DatabaseEndpoint", { 
      value: databaseStack.database.dbInstanceEndpointAddress,
    });
  }
}

const app = new cdk.App();

const databaseStack = new DatabaseStack(app, "SaasDatabaseStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-2",
  },
  description: "PostgreSQL RDS database for SaaS application",
});

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

backendStack.addDependency(databaseStack);

cdk.Tags.of(app).add("Project", "SaaS-Application");
cdk.Tags.of(app).add("Environment", "Development");
cdk.Tags.of(app).add("ManagedBy", "AWS-CDK");