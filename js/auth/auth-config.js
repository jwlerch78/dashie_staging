// js/auth/auth-config.js - Simple Auth Configuration (Keep existing + add logging config)
// CHANGE SUMMARY: Keep existing client_secret, add logging configuration for new logging system

/**
 * Authentication Configuration
 * Keep this simple - just the essentials we need
 */
export const AUTH_CONFIG = {
  // Existing client secret (keep as-is)
  client_secret: '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'
};

/**
 * Logging Configuration for new logging system
 */
export const LOGGING_CONFIG = {
  // Environment detection
  get environment() {
    const hostname = window.location.hostname;
    if (hostname === 'dashieapp.com') return 'production';
    if (hostname === 'dev.dashieapp.com') return 'development';
    return 'development';
  },

  // Log level based on environment
  get level() {
    return this.environment === 'development' ? 'debug' : 'info';
  },
  
  // Category toggles - more verbose in development
  get enableApiLogging() {
    return this.environment === 'development';
  },
  
  enableAuthLogging: true,
  
  get enableDataLogging() {
    return this.environment === 'development';
  },
  
  get enableWidgetLogging() {
    return this.environment === 'development';
  },
  
  // Format options
  enableTimestamps: true,
  enableModuleNames: true,
  enableColors: true
};

// Default export for backward compatibility
export default AUTH_CONFIG;
