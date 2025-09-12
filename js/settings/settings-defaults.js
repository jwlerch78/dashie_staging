// js/ui/settings/settings-defaults.js
// Default settings structure and validation schemas

// Settings schema with validation and descriptions
export const SETTINGS_SCHEMA = {
  photos: {
    transitionTime: {
      type: 'number',
      min: 1,
      max: 60,
      default: 5,
      description: 'Time between photo transitions (seconds)'
    }
  },
  
  display: {
    sleepTime: {
      type: 'time',
      default: '22:00',
      description: 'When display goes to sleep'
    },
    wakeTime: {
      type: 'time', 
      default: '07:00',
      description: 'When display wakes up'
    },
    reSleepDelay: {
      type: 'number',
      min: 1,
      max: 120,
      default: 30,
      description: 'Minutes before auto-sleep after wake'
    },
    theme: {
      type: 'select',
      options: ['dark', 'light'],
      default: 'dark',
      description: 'Display theme'
    }
  },
  
  accounts: {
    dashieAccount: {
      type: 'email',
      readonly: true,
      description: 'Your Dashie account email'
    },
    connectedServices: {
      type: 'array',
      default: [],
      description: 'Connected Google services'
    },
    pinEnabled: {
      type: 'boolean',
      default: false,
      description: 'Require PIN to access settings'
    }
  },
  
  family: {
    familyName: {
      type: 'string',
      maxLength: 50,
      default: '',
      description: 'Your family name'
    },
    members: {
      type: 'array',
      default: [],
      description: 'Family member profiles'
    }
  },
  
  system: {
    refreshInterval: {
      type: 'number',
      min: 10,
      max: 300,
      default: 30,
      description: 'Dashboard refresh interval (seconds)'
    },
    developer: {
      type: 'object',
      properties: {
        defaultEnvironment: {
          type: 'select',
          options: ['prod', 'dev'],
          default: 'prod',
          description: 'Default environment on login'
        },
        autoRedirect: {
          type: 'boolean',
          default: false,
          description: 'Auto-redirect to default environment'
        }
      }
    }
  }
};

// Category definitions with UI metadata
export const SETTINGS_CATEGORIES = [
  {
    id: 'accounts',
    label: '🔐 Accounts',
    icon: '🔐',
    enabled: true,
    description: 'Manage your account and connected services',
    settings: ['dashieAccount', 'connectedServices', 'pinEnabled']
  },
  {
    id: 'family', 
    label: '👨‍👩‍👧‍👦 Family',
    icon: '👨‍👩‍👧‍👦',
    enabled: false, // Grayed out for MVP
    description: 'Family member profiles and settings',
    settings: ['familyName', 'members']
  },
  {
    id: 'widgets',
    label: '🖼️ Widgets', 
    icon: '🖼️',
    enabled: true,
    description: 'Configure dashboard widgets',
    settings: ['photos.transitionTime']
  },
  {
    id: 'display',
    label: '🎨 Display',
    icon: '🎨', 
    enabled: true,
    description: 'Theme and sleep settings',
    settings: ['display.sleepTime', 'display.wakeTime', 'display.reSleepDelay', 'display.theme']
  },
  {
    id: 'system',
    label: '🔧 System',
    icon: '🔧',
    enabled: false, // Will enable when we add developer settings
    description: 'System and developer settings',
    settings: ['system.refreshInterval', 'system.developer']
  },
  {
    id: 'about',
    label: 'ℹ️ About',
    icon: 'ℹ️',
    enabled: false, // Grayed out for MVP
    description: 'Version info and support',
    settings: []
  }
];

// Generate default settings from schema
export function generateDefaultSettings(userEmail = 'unknown@example.com') {
  const defaults = {
    // Photos
    photos: {
      transitionTime: SETTINGS_SCHEMA.photos.transitionTime.default
    },
    
    // Display
    display: {
      sleepTime: SETTINGS_SCHEMA.display.sleepTime.default,
      wakeTime: SETTINGS_SCHEMA.display.wakeTime.default,
      reSleepDelay: SETTINGS_SCHEMA.display.reSleepDelay.default,
      theme: SETTINGS_SCHEMA.display.theme.default
    },
    
    // Accounts
    accounts: {
      dashieAccount: userEmail,
      connectedServices: [...SETTINGS_SCHEMA.accounts.connectedServices.default],
      pinEnabled: SETTINGS_SCHEMA.accounts.pinEnabled.default
    },
    
    // Family
    family: {
      familyName: SETTINGS_SCHEMA.family.familyName.default,
      members: [...SETTINGS_SCHEMA.family.members.default]
    },
    
    // System
    system: {
      refreshInterval: SETTINGS_SCHEMA.system.refreshInterval.default,
      developer: {
        defaultEnvironment: SETTINGS_SCHEMA.system.developer.properties.defaultEnvironment.default,
        autoRedirect: SETTINGS_SCHEMA.system.developer.properties.autoRedirect.default
      }
    },
    
    // Metadata
    version: '2.0.0',
    lastModified: Date.now()
  };
  
  return defaults;
}

// Validate a setting value against its schema
export function validateSetting(path, value) {
  const pathParts = path.split('.');
  let schema = SETTINGS_SCHEMA;
  
  // Navigate to the setting schema
  for (const part of pathParts) {
    if (schema[part]) {
      schema = schema[part];
    } else if (schema.properties && schema.properties[part]) {
      schema = schema.properties[part];
    } else {
      return { valid: false, error: `Setting path not found: ${path}` };
    }
  }
  
  // If we navigated to a nested object, we can't validate it directly
  if (schema.type === 'object') {
    return { valid: true }; // Let nested validation handle it
  }
  
  // Type validation
  switch (schema.type) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: 'Must be a number' };
      }
      if (schema.min !== undefined && value < schema.min) {
        return { valid: false, error: `Must be at least ${schema.min}` };
      }
      if (schema.max !== undefined && value > schema.max) {
        return { valid: false, error: `Must be no more than ${schema.max}` };
      }
      break;
      
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Must be a string' };
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        return { valid: false, error: `Must be no more than ${schema.maxLength} characters` };
      }
      break;
      
    case 'email':
      if (typeof value !== 'string' || !value.includes('@')) {
        return { valid: false, error: 'Must be a valid email address' };
      }
      break;
      
    case 'time':
      if (typeof value !== 'string' || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        return { valid: false, error: 'Must be a valid time (HH:MM)' };
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Must be true or false' };
      }
      break;
      
    case 'select':
      if (!schema.options || !schema.options.includes(value)) {
        return { valid: false, error: `Must be one of: ${schema.options?.join(', ')}` };
      }
      break;
      
    case 'array':
      if (!Array.isArray(value)) {
        return { valid: false, error: 'Must be an array' };
      }
      break;
      
    default:
      return { valid: true }; // Unknown type, allow it
  }
  
  return { valid: true };
}

// Get setting metadata from schema
export function getSettingInfo(path) {
  const pathParts = path.split('.');
  let schema = SETTINGS_SCHEMA;
  
  // Navigate to the setting schema
  for (const part of pathParts) {
    if (schema[part]) {
      schema = schema[part];
    } else if (schema.properties && schema.properties[part]) {
      schema = schema.properties[part];
    } else {
      return null;
    }
  }
  
  return {
    type: schema.type,
    description: schema.description,
    options: schema.options,
    min: schema.min,
    max: schema.max,
    default: schema.default,
    readonly: schema.readonly
  };
}

// Migration helpers for settings version updates
export function migrateSettings(settings, fromVersion, toVersion) {
  console.log(`⚙️ 🔄 Migrating settings from v${fromVersion} to v${toVersion}`);
  
  // Add migration logic here when needed
  // For now, just ensure all required fields exist
  const defaults = generateDefaultSettings(settings.accounts?.dashieAccount);
  const migrated = { ...defaults, ...settings };
  
  migrated.version = toVersion;
  migrated.lastModified = Date.now();
  
  return migrated;
}
