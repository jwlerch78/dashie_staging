// js/auth/cognito-config.js
// CHANGE SUMMARY: Added Identity Pool ID configuration for Google token pass-through

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
  userPoolId: 'us-east-2_wNbo8Y8LM',
  userPoolWebClientId: '6is70fls6vp2i511k93ltgs66h', // Fixed to match your actual URL
  
  // NEW: Identity Pool ID for Google token pass-through
  identityPoolId: 'us-east-2:1dda46ad-470e-4415-a22c-8c7fc3508112',
  
  // Cognito Domain
  domain: 'us-east-2wnbo8y8lm.auth.us-east-2.amazoncognito.com',
  
  // OAuth Configuration - FIXED CALLBACK URL
  oauth: {
    // Start with basic scopes that work, then add Google API scopes later
    scope: ['openid', 'email', 'profile'],
    
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

// Amplify Configuration Object - ENHANCED with Identity Pool
export const AMPLIFY_CONFIG = {
  Auth: {
    region: COGNITO_CONFIG.region,
    userPoolId: COGNITO_CONFIG.userPoolId,
    userPoolWebClientId: COGNITO_CONFIG.userPoolWebClientId,
    
    // NEW: Identity Pool configuration
    identityPoolId: COGNITO_CONFIG.identityPoolId,
    
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
console.log('🔐 Using Identity Pool ID:', COGNITO_CONFIG.identityPoolId);
console.log('🔐 Redirect URLs:', {
  signIn: COGNITO_CONFIG.oauth.redirectSignIn,
  signOut: COGNITO_CONFIG.oauth.redirectSignOut
});
console.log('🔐 Scopes:', COGNITO_CONFIG.oauth.scope);
