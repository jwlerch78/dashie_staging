// js/auth/cognito-config.js
// CHANGE SUMMARY: Fixed callback URL to use /oauth2/idpresponse instead of /auth/callback

// Environment detection
function getEnvironment() {
  const hostname = window.location.hostname;
  if (hostname === 'dashieapp.com') return 'production';
  if (hostname === 'dev.dashieapp.com') return 'development';
  return 'development'; // Default for localhost and other domains
}
const environment = getEnvironment();

// Cognito Configuration
export const COGNITO_CONFIG = {
  // AWS Cognito Settings - USE THE CORRECT CLIENT ID
  region: 'us-east-2',
  userPoolId: 'us-east-2_nbo8y8lm',
  userPoolWebClientId: '35h8kpkr2j8agv1m1id7vfal6m', // Fixed to match your actual URL
  
  // Cognito Domain
  domain: 'us-east-2wnbo8y8lm.auth.us-east-2.amazoncognito.com',
  
  // OAuth Configuration - FIXED CALLBACK URL
  oauth: {
    // Start with basic scopes that work, then add Google API scopes later
    scope: ['openid', 'email'],
    
    // FIXED: Use the standard Cognito callback URL
    redirectSignIn: environment === 'production' 
      ? 'https://dashieapp.com/oauth2/idpresponse'
      : 'https://dev.dashieapp.com/oauth2/idpresponse',
    redirectSignOut: environment === 'production'
      ? 'https://dashieapp.com/'
      : 'https://dev.dashieapp.com/',
    responseType: 'code' // Authorization Code Grant
  },
  
  // Storage Configuration
  storage: {
    userDataKey: 'dashie-cognito-user',
    sessionKey: 'dashie-cognito-session'
  }
};

// Amplify Configuration Object
export const AMPLIFY_CONFIG = {
  Auth: {
    region: COGNITO_CONFIG.region,
    userPoolId: COGNITO_CONFIG.userPoolId,
    userPoolWebClientId: COGNITO_CONFIG.userPoolWebClientId,
    oauth: {
      domain: COGNITO_CONFIG.domain,
      scope: COGNITO_CONFIG.oauth.scope,
      redirectSignIn: COGNITO_CONFIG.oauth.redirectSignIn,
      redirectSignOut: COGNITO_CONFIG.oauth.redirectSignOut,
      responseType: COGNITO_CONFIG.oauth.responseType
    }
  }
};

console.log('🔐 Cognito config loaded for environment:', environment);
console.log('🔐 Using client ID:', COGNITO_CONFIG.userPoolWebClientId);
console.log('🔐 Redirect URLs:', {
  signIn: COGNITO_CONFIG.oauth.redirectSignIn,
  signOut: COGNITO_CONFIG.oauth.redirectSignOut
});
console.log('🔐 Scopes:', COGNITO_CONFIG.oauth.scope);
