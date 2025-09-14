// js/auth/device-flow-auth.js - OAuth Device Flow for Fire TV (Enhanced Debug Version)

import { AUTH_CONFIG } from './auth-config.js';

export class DeviceFlowAuth {
  constructor() {
    this.config = {
      client_id: '221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9.apps.googleusercontent.com',
      client_secret: AUTH_CONFIG.client_secret,
      device_code_endpoint: 'https://oauth2.googleapis.com/device/code',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      // ✅ UPDATED: Add Google Photos and Calendar scopes
      scope: 'openid email profile https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/calendar.readonly'
    };
    this.pollInterval = null;
    this.countdownInterval = null;
  }

  // Start the device flow authentication
  async startDeviceFlow() {
    try {
      console.log('🔥 Starting OAuth Device Flow...');
      
      // Step 1: Get device code and user code
      const deviceData = await this.getDeviceCode();
      
      // Step 2: Show UI and start polling SIMULTANEOUSLY
      const result = await this.showUIAndPoll(deviceData);
      
      return result;
      
    } catch (error) {
      console.error('🔥 Device flow failed:', error);
      this.cleanup();
      throw error;
    }
  }

  // Step 1: Get device code from Google
  async getDeviceCode() {
    console.log('🔥 Requesting device code from Google...');
    
    const response = await fetch(this.config.device_code_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.client_id,
        scope: this.config.scope
      })
    });

    console.log('🔥 Device code response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔥 Device code request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to get device code: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🔥 Device code received successfully:', {
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      verification_url: data.verification_url,
      expires_in: data.expires_in,
      interval: data.interval
    });

    return data;
  }

  // Step 2: Show UI and start polling concurrently
  async showUIAndPoll(deviceData) {
    return new Promise((resolve, reject) => {
      // Create and show the UI
      const overlay = this.createDeviceCodeOverlay(deviceData);
      document.body.appendChild(overlay);

      // Set up cancel handling
      this.setupDeviceCodeNavigation(overlay, () => {
        console.log('🔥 User cancelled - cleaning up');
        this.cleanup(overlay);
        resolve({ success: false, cancelled: true });
      });

      // Start countdown
      this.startCountdown(overlay, deviceData.expires_in);

      // START POLLING IMMEDIATELY - Don't wait for anything
      console.log('🔥 🚀 STARTING CONCURRENT POLLING');
      this.startPolling(deviceData.device_code, deviceData.interval, overlay, resolve, reject);
    });
  }

  // Step 3: Start polling immediately (runs concurrently with UI)
  startPolling(deviceCode, interval, overlay, resolve, reject) {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max
    
    console.log('🔥 🚀 STARTING TOKEN POLLING');
    console.log('🔥 Device code:', deviceCode);
    console.log('🔥 Interval:', interval);
    console.log('🔥 Max attempts:', maxAttempts);
    
    const poll = async () => {
      try {
        attempts++;
        console.log(`🔥 📡 POLLING ATTEMPT ${attempts}/${maxAttempts}`);
        
        if (attempts > maxAttempts) {
          console.log('🔥 ❌ Polling timeout reached');
          this.cleanup(overlay);
          reject(new Error('Polling timeout - please try again'));
          return;
        }
        
        console.log('🔥 📤 Making token request...');
        
        const requestBody = new URLSearchParams({
          client_id: this.config.client_id,
          client_secret: this.config.client_secret,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        });
        
        console.log('🔥 📤 Request body:', requestBody.toString());
        console.log('🔥 📤 Client ID being used:', this.config.client_id);
        console.log('🔥 📤 Device code length:', deviceCode.length);
        console.log('🔥 📤 Grant type:', 'urn:ietf:params:oauth:grant-type:device_code');
        
        const response = await fetch(this.config.token_endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: requestBody
        });
        
        console.log('🔥 📥 Token response status:', response.status);
        console.log('🔥 📥 Token response ok:', response.ok);
        console.log('🔥 📥 Token response headers:', Object.fromEntries(response.headers.entries()));
        
        const data = await response.json();
        console.log('🔥 📥 Token response data:', {
          hasAccessToken: !!data.access_token,
          error: data.error,
          errorDescription: data.error_description,
          fullResponse: data
        });
        
     if (response.ok && data.access_token) {
  // Success!
  console.log('🔥 ✅ ACCESS TOKEN RECEIVED! Authentication successful!');
  
  // DEBUG: Log token details
  console.log('🔍 DEBUG Device Flow Tokens:', {
    has_access_token: !!data.access_token,
    access_token_length: data.access_token?.length,
    access_token_preview: data.access_token?.substring(0, 20) + '...',
    token_type: data.token_type,
    expires_in: data.expires_in,
    scope: data.scope,
    full_response_keys: Object.keys(data)
  });
  
  try {
    console.log('🔥 👤 Getting user info...');
    const userInfo = await this.getUserInfo(data.access_token);
    
    // DEBUG: Log user info
    console.log('🔍 DEBUG User Info:', {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      has_picture: !!userInfo.picture
    });
    
    this.cleanup(overlay);
    
    // DEBUG: Log what we're returning
    const result = {
      success: true,
      user: userInfo,
      tokens: data
    };
    console.log('🔍 DEBUG Device Flow Result:', {
      success: result.success,
      user_id: result.user.id,
      has_tokens: !!result.tokens,
      tokens_has_access_token: !!result.tokens.access_token
    });
    
    resolve(result);
    return;
  } catch (userError) {
    console.error('🔥 ❌ Failed to get user info:', userError);
    this.cleanup(overlay);
    reject(new Error('Failed to get user information'));
    return;
  }
          
        } else if (data.error === 'authorization_pending') {
          // Still waiting for user to authorize
          console.log('🔥 ⏳ Still waiting for authorization... scheduling next poll in', interval, 'seconds');
          this.pollInterval = setTimeout(poll, interval * 1000);
          
        } else if (data.error === 'slow_down') {
          // Increase polling interval
          const newInterval = interval + 5;
          console.log('🔥 🐌 Slowing down polling to', newInterval, 'seconds...');
          this.pollInterval = setTimeout(poll, newInterval * 1000);
          
        } else if (data.error === 'invalid_request' && data.error_description?.includes('client_secret')) {
          // Client secret error - try without it
          console.log('🔥 🔧 Retrying without client_secret parameter...');
          
          const retryBody = new URLSearchParams({
            client_id: this.config.client_id,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          });
          
          console.log('🔥 📤 Retry request body (no client_secret):', retryBody.toString());
          
          const retryResponse = await fetch(this.config.token_endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: retryBody
          });
          
          const retryData = await retryResponse.json();
          console.log('🔥 📥 Retry response:', retryData);
          
          if (retryResponse.ok && retryData.access_token) {
            console.log('🔥 ✅ ACCESS TOKEN RECEIVED on retry!');
            try {
              const userInfo = await this.getUserInfo(retryData.access_token);
              this.cleanup(overlay);
              resolve({
                success: true,
                user: userInfo,
                tokens: retryData
              });
              return;
            } catch (userError) {
              console.error('🔥 ❌ Failed to get user info on retry:', userError);
              this.cleanup(overlay);
              reject(new Error('Failed to get user information'));
              return;
            }
          } else if (retryData.error === 'authorization_pending') {
            console.log('🔥 ⏳ Still pending on retry... continuing polling');
            this.pollInterval = setTimeout(poll, interval * 1000);
          } else {
            console.log('🔥 ❌ Retry also failed:', retryData);
            this.cleanup(overlay);
            reject(new Error(retryData.error_description || retryData.error || 'Authentication failed'));
          }
          
        } else {
          // Other error
          console.log('🔥 ❌ Authentication error:', data.error, data.error_description);
          this.cleanup(overlay);
          reject(new Error(data.error_description || data.error || 'Authentication failed'));
        }
        
      } catch (error) {
        console.error('🔥 ❌ Polling fetch error:', error);
        console.log('🔥 🔄 Retrying polling in', interval, 'seconds...');
        this.pollInterval = setTimeout(poll, interval * 1000);
      }
    };
    
    // Start polling immediately
    console.log('🔥 🎬 Starting first poll NOW...');
    poll();
  }

  createDeviceCodeOverlay(deviceData) {
  const overlay = document.createElement('div');
  overlay.id = 'device-flow-overlay';
  
  // Extract the correct URL field from Google's response
  const verificationUrl = deviceData.verification_uri || deviceData.verification_url || 'https://www.google.com/device';
  
  console.log('🔥 Device Flow Data received:', {
    verification_uri: deviceData.verification_uri,
    verification_url: deviceData.verification_url,
    user_code: deviceData.user_code,
    device_code: deviceData.device_code,
    expires_in: deviceData.expires_in,
    interval: deviceData.interval,
    finalUrl: verificationUrl
  });
  
  overlay.innerHTML = `
    <div class="device-flow-modal">
      <div class="device-flow-header">
        <svg class="google-logo-header" width="24" height="24" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <h2>Sign in to your Google Account</h2>
      </div>
      
      <div class="device-flow-content">
        <div class="instruction-text">
          <p>On your phone or computer, go to:</p>
          <div class="verification-url">${verificationUrl}</div>
        </div>
        
        <div class="instruction-text">
          <p>Enter this code:</p>
          <div class="user-code">${deviceData.user_code}</div>
        </div>
        
        <div class="device-flow-status">
          <div class="loading-spinner"></div>
          <p>Waiting for sign-in...</p>
        </div>
      </div>
      
      <div class="device-flow-footer">
        <button id="cancel-device-flow" class="device-flow-button" tabindex="1">
          Cancel
        </button>
        <p class="expiry-text">Code expires in <span id="countdown">${Math.floor(deviceData.expires_in / 60)}</span> minutes</p>
      </div>
    </div>
  `;

  // Apply styles
  this.applyDeviceFlowStyles(overlay);
  
  return overlay;
}
  
 applyDeviceFlowStyles(overlay) {
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const style = document.createElement('style');
  style.textContent = `
    .device-flow-modal {
      background: #FCFCFF;
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      width: 90%;
      text-align: center;
      color: #424242;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-height: 90vh;
      overflow-y: auto;
    }
    
    .device-flow-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e8eaed;
    }
    
    .google-logo-header {
      flex-shrink: 0;
    }
    
    .device-flow-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: #424242;
    }
    
    .device-flow-content {
      margin: 20px 0;
    }
    
    .instruction-text {
      margin-bottom: 16px;
    }
    
    .instruction-text p {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #424242;
      font-weight: 400;
    }
    
    .verification-url {
      background: #f8f9fa;
      padding: 10px 14px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 16px;
      font-weight: 500;
      color: #424242;
      border: 1px solid #dadce0;
      margin-bottom: 4px;
    }
    
    .user-code {
      background: #f8f9fa;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 24px;
      font-weight: 600;
      color: #424242;
      border: 1px solid #dadce0;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    
    .device-flow-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 20px 0;
      padding: 12px;
      background: #f0f8ff;
      border-radius: 6px;
    }
    
    .device-flow-status p {
      margin: 0;
      font-size: 13px;
      color: #5f6368;
    }
    
    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #e3f2fd;
      border-top: 2px solid #1a73e8;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .device-flow-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e8eaed;
    }
    
    .device-flow-button {
      padding: 10px 24px;
      border: 1px solid #dadce0;
      border-radius: 6px;
      background: #f8f9fa;
      color: #5f6368;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      margin-bottom: 12px;
    }
    
    .device-flow-button:hover,
    .device-flow-button:focus {
      background: #f1f3f4;
      outline: 3px solid #ffaa00;
      transform: scale(1.02);
    }
    
    .expiry-text {
      margin: 0;
      font-size: 12px;
      color: #9aa0a6;
    }
    
    #countdown {
      font-weight: 600;
      color: #ea4335;
    }
    
    /* Fire TV layout adjustments */
    @media (max-width: 1920px) and (max-height: 1080px) {
      .device-flow-modal {
        max-width: 520px;
        padding: 36px;
      }
      
      .device-flow-header h2 {
        font-size: 22px;
      }
      
      .verification-url {
        font-size: 18px;
        padding: 12px 16px;
      }
      
      .user-code {
        font-size: 28px;
        padding: 14px 18px;
      }
      
      .device-flow-button {
        font-size: 16px;
        padding: 12px 28px;
      }
    }
  `;
  
  document.head.appendChild(style);
}
  
  setupDeviceCodeNavigation(overlay, onCancel) {
    const cancelBtn = overlay.querySelector('#cancel-device-flow');
    
    // Auto-focus cancel button
    setTimeout(() => cancelBtn.focus(), 200);
    
    // Cancel button handler
    cancelBtn.addEventListener('click', onCancel);
    
    // Keyboard navigation
    overlay.addEventListener('keydown', (e) => {
      if (e.keyCode === 4 || e.key === 'Escape') { // Back button
        e.preventDefault();
        onCancel();
      } else if (e.keyCode === 13 || e.keyCode === 23) { // Enter
        if (document.activeElement === cancelBtn) {
          onCancel();
        }
      }
    });
  }

  startCountdown(overlay, expiresIn) {
    const countdownEl = overlay.querySelector('#countdown');
    let remaining = expiresIn;
    
    const updateCountdown = () => {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      if (remaining <= 0) {
        console.log('🔥 ⏰ Device code expired');
        this.cleanup(overlay);
        return;
      }
      
      remaining--;
    };
    
    // Update immediately and then every second
    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }

  // Step 4: Get user information
  async getUserInfo(accessToken) {
    console.log('🔥 👤 Fetching user info...');
    
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔥 Failed to get user info:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error('Failed to get user information');
    }
    
    const userInfo = await response.json();
    console.log('🔥 👤 User info received:', {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email
    });
    
    return {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      picture: userInfo.picture,
      authMethod: 'device_flow'
    };
  }

  cleanup(overlay) {
    console.log('🔥 🧹 Cleaning up device flow...');
    
    // Clear intervals
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    // Remove overlay
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
}
