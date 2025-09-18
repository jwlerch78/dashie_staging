// js/core/theme.js - Complete Theme Management System with Flash Prevention


const storage = (() => {
  try {
    return localStorage;
  } catch (e) {
    return { 
      getItem: () => null, 
      setItem: () => {}, 
      removeItem: () => {} 
    };
  }
})();

// ---------------------
// THEME CONSTANTS
// ---------------------

export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light'
};

export const THEME_CONFIG = {
  [THEMES.DARK]: {
    name: 'Dark Theme',
    className: 'theme-dark',
    logoSrc: '/icons/Dashie_Full_Logo_White_Transparent.png'
  },
  [THEMES.LIGHT]: {
    name: 'Light Theme', 
    className: 'theme-light',
    logoSrc: '/icons/Dashie_Full_Logo_Black_Transparent.png'
  }
};

// ---------------------
// THEME STATE
// ---------------------

let currentTheme = THEMES.LIGHT; // Default theme

// ---------------------
// WIDGET THEME APPLICATION
// ---------------------

function canAccessIframe(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    return doc !== null && doc !== undefined;
  } catch (error) {
    return false;
  }
}

function applyThemeClassToWidget(iframe, theme) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc || !doc.body) {
      console.warn('Cannot access iframe body for theme application');
      return false;
    }

    // Remove all existing theme classes
    Object.values(THEMES).forEach(t => {
      doc.body.classList.remove(`theme-${t}`);
    });
    
    // Add new theme class (CSS variables will handle the rest)
    doc.body.classList.add(`theme-${theme}`);
    
    return true;

  } catch (error) {
    console.warn('Theme class application failed:', error.message);
    return false;
  }
}

function sendThemeViaPostMessage(iframe, theme) {
  if (!iframe.contentWindow) return;
  
  try {
    iframe.contentWindow.postMessage({
      type: 'theme-change',
      theme: theme,
      themeClass: `theme-${theme}`,
      themeConfig: THEME_CONFIG[theme]
    }, '*');
    console.log(`📤 Sent ${theme} theme via postMessage`);
  } catch (error) {
    console.warn('PostMessage failed:', error.message);
  }
}

// ---------------------
// THEME PERSISTENCE
// ---------------------

function loadSavedTheme() {
  try {
    const saved = storage.getItem('dashie-theme');
    if (saved && Object.values(THEMES).includes(saved)) {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to load saved theme:', e);
  }
  return THEMES.DARK;
}

function saveTheme(theme) {
  try {
    storage.setItem('dashie-theme', theme);
    console.log(`💾 Theme saved: ${theme}`);
  } catch (e) {
    console.warn('Failed to save theme:', e);
  }
}

// ---------------------
// THEME APPLICATION
// ---------------------

function updateLogo(theme) {
  const logo = document.querySelector('.dashie-logo');
  if (logo) {
    logo.src = THEME_CONFIG[theme].logoSrc;
    console.log(`🖼️ Logo updated for ${theme} theme`);
  } else {
    console.warn('🖼️ Dashie logo element not found - will retry');
    // Retry after a short delay if logo element doesn't exist yet
    setTimeout(() => {
      const retryLogo = document.querySelector('.dashie-logo');
      if (retryLogo) {
        retryLogo.src = THEME_CONFIG[theme].logoSrc;
        console.log(`🖼️ Logo updated on retry for ${theme} theme`);
      } else {
        console.warn('🖼️ Logo element still not found after retry');
      }
    }, 200);
  }
}

function applyThemeToBody(theme) {
  const body = document.body;
  
  // Remove all existing theme classes
  Object.values(THEMES).forEach(t => {
    body.classList.remove(`theme-${t}`);
  });
  
  // Add the new theme class
  body.classList.add(`theme-${theme}`);
  
}

function preventTransitionsOnLoad() {
  document.body.classList.add('no-transitions');
  setTimeout(() => {
    document.body.classList.remove('no-transitions');
  }, 200); // Increased timeout to ensure theme is fully applied
}

// NEW: Apply theme immediately to prevent flash
export function applyThemeBeforeLoad() {
  const savedTheme = loadSavedTheme();
  currentTheme = savedTheme;
  
  // Apply theme class immediately - even before DOM is ready
  if (document.body) {
    applyThemeToBody(savedTheme);
  } else {
    // If body doesn't exist yet, apply when it does
    const observer = new MutationObserver((mutations, obs) => {
      if (document.body) {
        applyThemeToBody(savedTheme);
        obs.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }
  
}

// ---------------------
// WIDGET COMMUNICATION
// ---------------------

function notifyWidgetsThemeChange(theme) {
  const iframes = document.querySelectorAll('.widget-iframe');
  let classApplicationCount = 0;
  let postMessageCount = 0;
  
  iframes.forEach((iframe, index) => {
    console.log(`🎨 Applying ${theme} theme to widget ${index + 1}/${iframes.length}`);
    
    // Method 1: Try direct CSS class application (uses your CSS variables)
    if (canAccessIframe(iframe)) {
      const success = applyThemeClassToWidget(iframe, theme);
      if (success) {
        classApplicationCount++;
        return;
      }
    }
    
    // Method 2: Fallback to postMessage
    sendThemeViaPostMessage(iframe, theme);
    postMessageCount++;
  });
  
}

function handleWidgetThemeRequest(widgetName) {
  const iframes = document.querySelectorAll('.widget-iframe');
  
  iframes.forEach(iframe => {
    if (canAccessIframe(iframe)) {
      applyThemeClassToWidget(iframe, currentTheme);
    } else {
      sendThemeViaPostMessage(iframe, currentTheme);
    }
  });
  
  console.log(`📡 Sent current theme (${currentTheme}) to requesting widget: ${widgetName}`);
}

function initializeWidgetCommunication() {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'widget-request-theme') {
      handleWidgetThemeRequest(event.data.widget || 'unknown');
    }
  });
}

function applyThemeToNewWidget(iframe) {
  setTimeout(() => {
    if (canAccessIframe(iframe)) {
      applyThemeClassToWidget(iframe, currentTheme);
      console.log(`🎨 Applied ${currentTheme} theme to newly loaded widget`);
    } else {
      sendThemeViaPostMessage(iframe, currentTheme);
    }
  }, 100);
}

// ---------------------
// PUBLIC API
// ---------------------

export function getCurrentTheme() {
  return currentTheme;
}

export function getAvailableThemes() {
  return Object.keys(THEME_CONFIG).map(key => ({
    id: key,
    name: THEME_CONFIG[key].name
  }));
}

export function switchTheme(newTheme) {
  if (!Object.values(THEMES).includes(newTheme)) {
    console.warn(`Invalid theme: ${newTheme}`);
    return false;
  }
  
  console.log(`🎨 Switching theme from ${currentTheme} to ${newTheme}`);
  
  currentTheme = newTheme;
  
  // Apply theme changes
  applyThemeToBody(newTheme);
  updateLogo(newTheme);
  saveTheme(newTheme);
  
  // Notify widgets about theme change
  notifyWidgetsThemeChange(newTheme);
  
  console.log(`✅ Theme switched to: ${THEME_CONFIG[newTheme].name}`);
  return true;
}

export function initializeThemeSystem() {
  
  // IMPORTANT: Apply theme before preventing transitions to avoid flash
  applyThemeBeforeLoad();
  preventTransitionsOnLoad();
  
  initializeWidgetCommunication();
  
  // Apply theme to any existing widgets
  setTimeout(() => {
    notifyWidgetsThemeChange(currentTheme);
  }, 500);
  
  // Update logo with multiple retries to ensure sidebar is rendered
  updateLogo(currentTheme);
  setTimeout(() => updateLogo(currentTheme), 300);
  setTimeout(() => updateLogo(currentTheme), 600);

}

export function applyThemeToWidget(iframe) {
  applyThemeToNewWidget(iframe);
}

// ---------------------
// THEME UTILITIES
// ---------------------

export function isDarkTheme() {
  return currentTheme === THEMES.DARK;
}

export function isLightTheme() {
  return currentTheme === THEMES.LIGHT;
}

export function getThemeDisplayName(theme = currentTheme) {
  return THEME_CONFIG[theme]?.name || 'Unknown Theme';
}

// ---------------------
// EARLY THEME APPLICATION (prevents flash)
// ---------------------

// Apply theme as early as possible - even before main initialization
if (typeof window !== 'undefined') {
  // Run immediately when script loads
  applyThemeBeforeLoad();
}
