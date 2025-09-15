// js/core/events.js - Unified Input Handling System

import { state, elements, setFocus, setWidgetReady } from './state.js';
import { moveFocus, handleEnter, handleBack, openMenuWithCurrentSelection, updateFocus } from './navigation.js';

// ---------------------
// WIDGET MESSAGE HANDLING
// ---------------------

function initializeWidgetMessages() {
  // Listen for messages from widgets
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'widget-ready') {
      const widgetId = event.data.widget;
      setWidgetReady(widgetId, true);
    }
  });
}

// ---------------------
// UNIFIED INPUT PROCESSING
// ---------------------

// Convert various input sources to standardized action strings
function normalizeInput(source, value) {
  if (source === 'keyboard') {
    // Browser keyboard event
    return {
      action: getActionFromKeyboardEvent(value),
      originalEvent: value
    };
  } else if (source === 'android') {
    // Android keycode
    return {
      action: getActionFromAndroidKeycode(value),
      originalEvent: null
    };
  }
  return { action: null, originalEvent: null };
}

// Map keyboard events to actions
function getActionFromKeyboardEvent(event) {
  const keyMap = {
    "ArrowLeft": "left",
    "ArrowRight": "right", 
    "ArrowUp": "up",
    "ArrowDown": "down",
    "Enter": "enter",
    "Escape": "escape",
    "Backspace": "escape",
    "m": "menu",
    "M": "menu",
    " ": "space",
    ",": "prev-view",
    ".": "next-view"
  };
  
  return keyMap[event.key] || null;
}

// Map Android keycodes to actions
function getActionFromAndroidKeycode(keyCode) {
  const keyMap = {
    // D-pad navigation
    38: "up",           // KEYCODE_DPAD_UP
    40: "down",         // KEYCODE_DPAD_DOWN  
    37: "left",         // KEYCODE_DPAD_LEFT
    39: "right",        // KEYCODE_DPAD_RIGHT
    13: "enter",        // KEYCODE_DPAD_CENTER / KEYCODE_ENTER
    
    // System keys
    4: "escape",        // KEYCODE_BACK (Android back button)
    82: "menu",         // KEYCODE_MENU
    77: "menu",         // M key for menu
    
    // Media keys for view cycling
    227: "prev-view",   // KEYCODE_MEDIA_REWIND
    228: "next-view",   // KEYCODE_MEDIA_FAST_FORWARD
    188: "prev-view",   // Alternative comma key
    190: "next-view",   // Alternative period key
    87: "next-view",    // KEYCODE_MEDIA_NEXT  
    88: "prev-view",    // KEYCODE_MEDIA_PREVIOUS
    
    // Sleep toggle
    179: "sleep-toggle", // KEYCODE_MEDIA_PLAY_PAUSE
    85: "sleep-toggle"   // Alternative play/pause
  };
  
  return keyMap[keyCode] || null;
}

// Unified input handler - processes all input regardless of source
async function handleUnifiedInput(action, originalEvent = null) {
  if (!action) {
    console.log('🎮 Ignoring unmapped input');
    return;
  }
  
  // Prevent default if we have an original event
  if (originalEvent) {
    originalEvent.preventDefault();
  }
  
  // NEW: Check if settings modal is open and let it handle events
  const settingsOverlay = document.querySelector('.settings-overlay.active');
  if (settingsOverlay) {
    console.log('🎮 Settings modal is open, letting it handle input');
    return; // Let settings modal handle its own navigation
  }
  
  // Handle special actions first
  if (action === "sleep-toggle") {
    await handleSleepToggle();
    return;
  }
  
  // Handle sleep mode - any key wakes up
  if (state.isAsleep) {
    const { wakeUp } = await import('../ui/modals.js');
    const { startResleepTimer } = await import('../ui/settings.js');
    wakeUp();
    startResleepTimer();
    return;
  }
  
  // Handle settings modal - UPDATED for new settings system
  try {
    const { isSettingsReady, handleSettingsKeyPress } = await import('../settings/settings-main.js');
    
    // Check if settings is open by looking for the overlay
    if (settingsOverlay) {
      console.log('🎮 Delegating to settings system');
      return; // Settings will handle their own events
    }
  } catch (err) {
    // Settings module not loaded yet, continue
    console.log('Settings system not ready, continuing with normal navigation');
  }
  
  // Handle exit confirmation dialog
  if (state.confirmDialog) {
    const { moveExitFocus, handleExitChoice } = await import('../ui/modals.js');
    switch (action) {
      case "left":
      case "right":
        moveExitFocus(action);
        break;
      case "up":
      case "down":
        // Map up/down to left/right for dialog navigation
        moveExitFocus(action === "up" ? "left" : "right");
        break;
      case "enter":
        handleExitChoice(state.confirmDialog.selectedButton);
        break;
      case "escape":
        handleExitChoice(state.confirmDialog.isAuthenticated ? "cancel" : "no");
        break;
    }
    return;
  }
  
  // If widget is focused, send commands to widget (except escape)
  if (state.selectedCell) {
    switch (action) {
      case "escape":
        handleBack(); // This will unfocus the widget
        break;
      default:
        // Send action to the widget (including prev-view/next-view for calendar)
        import('./navigation.js').then(({ sendToWidget }) => {
          sendToWidget(action);
        });
        break;
    }
    return;
  }
  
  // Regular navigation when no widget is focused
  switch (action) {
    case "left": 
      moveFocus("left"); 
      break;
    case "right": 
      moveFocus("right"); 
      break;
    case "up": 
      moveFocus("up"); 
      break;
    case "down": 
      moveFocus("down"); 
      break;
    case "enter": 
      handleEnter(); 
      break;
    case "escape": 
      handleBack(); 
      break;
    case "menu": 
      openMenuWithCurrentSelection(); 
      break;
    case "prev-view":
    case "next-view":
      // These only work when a widget is focused, ignore in main navigation
      break;
    default:
      break;
  }
}
// Helper function for sleep toggle
async function handleSleepToggle() {
  const { state } = await import('./state.js');
  
  if (state.isAsleep) {
    const { wakeUp } = await import('../ui/modals.js');
    const { startResleepTimer } = await import('../ui/settings.js');
    wakeUp();
    startResleepTimer();
  } else {
    const { enterSleepMode } = await import('../ui/modals.js');
    enterSleepMode();
  }
}

// ---------------------
// INPUT SOURCE HANDLERS
// ---------------------

// Browser keyboard events
export function initializeKeyboardEvents() {
  document.addEventListener("keydown", async e => {
    const { action, originalEvent } = normalizeInput('keyboard', e);
    if (action) {
      await handleUnifiedInput(action, originalEvent);
    }
  });
}

// Android WebView remote input (called by Android app)
window.handleRemoteInput = async function(keyCode) {
  console.log('🎮 Remote input received:', keyCode);
  const { action } = normalizeInput('android', keyCode);
  if (action) {
    await handleUnifiedInput(action);
  } else {
    console.log('🎮 Unmapped Android keycode:', keyCode);
  }
};

// ---------------------
// MOUSE EVENTS
// ---------------------

export function initializeMouseEvents() {
  // Document-level click handler for empty areas
  document.addEventListener("click", e => {
    const sidebarElement = elements.sidebar;
    const sidebarExpanded = sidebarElement.classList.contains("expanded");
    const clickedOnSidebar = sidebarElement.contains(e.target);
    
    console.log("🖱️ DOCUMENT CLICK DEBUG:", {
      isAsleep: state.isAsleep,
      confirmDialog: !!state.confirmDialog,
      sidebarExpanded: sidebarExpanded,
      clickTarget: e.target.tagName,
      clickTargetId: e.target.id,
      clickedOnSidebar: clickedOnSidebar,
      shouldClose: sidebarExpanded && !clickedOnSidebar && !state.confirmDialog && !state.isAsleep
    });
    
    // Early returns that prevent closing
    if (state.confirmDialog || state.isAsleep || !sidebarExpanded || clickedOnSidebar) {
      return;
    }
    
    // Close the sidebar
    elements.sidebar.classList.remove("expanded");
    
    if (state.focus.type === "menu") {
      setFocus({ type: "grid", row: 1, col: 1 });
      updateFocus();
    }
  });

  // Grid-level click handler as backup
  if (elements.grid) {
    elements.grid.addEventListener("click", e => {
      
      // Close sidebar if expanded
      if (elements.sidebar.classList.contains("expanded")) {
        elements.sidebar.classList.remove("expanded");
        
        // Return focus to grid
        if (state.focus.type === "menu") {
          setFocus({ type: "grid", row: 1, col: 1 });
          updateFocus();
        }
      }
    });
  }
}

// ---------------------
// INITIALIZATION
// ---------------------

export function initializeEvents() {
  initializeKeyboardEvents();
  initializeMouseEvents();
  initializeWidgetMessages();
  
}
