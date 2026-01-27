import { Amplify } from 'aws-amplify';
const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-2_xyVVCldfd',
      userPoolClientId: '2h6j1cjssdt0mcuehh5cdbmut7',
      identityPoolId: undefined,
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
        phone: false,
        username: false,
      },
      authenticationFlowType: 'USER_PASSWORD_AUTH',
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false,
      },
    },
  },
  API: {
    REST: {
      SaasApi: {
        endpoint: 'https://kx7ca5ymaf.execute-api.us-east-2.amazonaws.com/prod/', 
        region: 'us-east-2',
      },
    },
  },
  // Outras configurações opcionais
  Storage: {
    S3: {
      bucket: 'saasbackendstack-saasimagesbucket68a55755-nlfozznyot0e',
      region: 'us-east-2',
    },
  },
} as const;

Amplify.configure(awsConfig);

export { awsConfig };