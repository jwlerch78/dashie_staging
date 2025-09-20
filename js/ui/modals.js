// js/ui/modals.js - Enhanced Exit Modal with Auth Support

import { state, setSleepMode, setConfirmDialog } from '../core/state.js';

// ---------------------
// SLEEP MODE (keep existing functions)
// ---------------------

export function enterSleepMode() {
  setSleepMode(true);
  
  // Create sleep overlay
  const sleepOverlay = document.createElement("div");
  sleepOverlay.id = "sleep-overlay";
  sleepOverlay.className = "sleep-overlay";
  
  // IMPORTANT: Make sure it can receive keyboard events
  sleepOverlay.setAttribute('tabindex', '-1');
  sleepOverlay.focus();
  
  document.body.appendChild(sleepOverlay);
  
console.log('ading sleep layer')

  // Fade in
  setTimeout(() => {
    sleepOverlay.classList.add("visible");
  }, 10);
  
  // Add wake up listeners - BOTH click AND keydown
  sleepOverlay.addEventListener("click", wakeUp);
  sleepOverlay.addEventListener("keydown", (e) => {
    e.preventDefault();
    wakeUp();
  });
}

export function wakeUp() {
  console.log('🛌 wakeUp() called, state.isAsleep:', state.isAsleep);
  if (!state.isAsleep) return;
  
  setSleepMode(false);
  console.log('🛌 After setSleepMode(false), state.isAsleep:', state.isAsleep);
  
  const sleepOverlay = document.getElementById("sleep-overlay");
  console.log('🛌 sleepOverlay found:', !!sleepOverlay);
  
  if (sleepOverlay) {
    console.log('🛌 Before remove - classes:', sleepOverlay.classList.toString());
    console.log('🛌 Before remove - computed opacity:', window.getComputedStyle(sleepOverlay).opacity);
    
    sleepOverlay.classList.remove("visible");
    
    console.log('🛌 After remove - classes:', sleepOverlay.classList.toString());
    
    // Check immediately after class removal
    setTimeout(() => {
      console.log('🛌 100ms later - computed opacity:', window.getComputedStyle(sleepOverlay).opacity);
      console.log('🛌 100ms later - still in DOM:', !!document.getElementById("sleep-overlay"));
    }, 100);
    
    setTimeout(() => {
      console.log('🛌 500ms later - removing from DOM');
      const stillExists = document.getElementById("sleep-overlay");
      if (stillExists) {
        stillExists.remove();
        console.log('🛌 Overlay removed from DOM');
      }
      
      // Final check
      setTimeout(() => {
        const finalCheck = document.getElementById("sleep-overlay");
        console.log('🛌 Final check - overlay still exists:', !!finalCheck);
      }, 50);
    }, 500);
  }
}


// ---------------------
// ENHANCED EXIT CONFIRMATION WITH AUTH
// ---------------------

export function showExitConfirmation() {
  if (state.confirmDialog) return; // Already showing
  
  // Check if user is authenticated
  const isAuthenticated = window.dashieAuth && window.dashieAuth.isAuthenticated();
  const currentUser = isAuthenticated ? window.dashieAuth.getUser() : null;
  
  // Create modal backdrop
  const backdrop = document.createElement("div");
  backdrop.id = "exit-backdrop";
  backdrop.className = "modal-backdrop";
  
  // Create confirmation dialog
  const dialog = document.createElement("div");
  dialog.id = "exit-dialog";
  
  // Different content and styling based on auth status
  if (isAuthenticated && currentUser) {
    // Authenticated user - show logout and exit options using same format as simple-auth.js
    dialog.className = "exit-modal"; // Use the modal class from simple-auth.js
    dialog.innerHTML = `
      <div class="modal-option logout-option" id="exit-logout">
        <img src="${currentUser.picture}" alt="${currentUser.name}" class="user-photo-modal">
        <span>Logout ${currentUser.name.split(' ')[0]}</span>
      </div>
      
      <div class="modal-option exit-option" id="exit-app">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
        </svg>
        <span>Exit Dashie</span>
      </div>
      
      <div class="modal-option cancel-option" id="exit-cancel">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        <span>Cancel</span>
      </div>
    `;
    
    // Apply the backdrop class that matches simple-auth.js styling
    backdrop.className = "exit-modal-backdrop";
  } else {
    // Not authenticated - show simple exit confirmation with original styling
    dialog.className = "exit-dialog";
    dialog.innerHTML = `
      <h2>Are you sure you want to exit?</h2>
      <div class="exit-buttons">
        <button class="exit-button" id="exit-yes">Yes</button>
        <button class="exit-button" id="exit-no">No</button>
      </div>
    `;
  }
  
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  
  // Set up confirmation state
  const confirmDialog = {
    element: backdrop,
    selectedButton: isAuthenticated ? "cancel" : "no", // default to safe option
    isAuthenticated: isAuthenticated,
    buttons: {}
  };
  
  // Get button references based on auth status
  if (isAuthenticated) {
    confirmDialog.buttons = {
      logout: dialog.querySelector("#exit-logout"),
      exit: dialog.querySelector("#exit-app"), 
      cancel: dialog.querySelector("#exit-cancel")
    };
    confirmDialog.buttonOrder = ["logout", "exit", "cancel"];
  } else {
    confirmDialog.buttons = {
      yes: dialog.querySelector("#exit-yes"),
      no: dialog.querySelector("#exit-no")
    };
    confirmDialog.buttonOrder = ["yes", "no"];
  }
  
  setConfirmDialog(confirmDialog);
  updateExitButtonHighlight();
  
  // Add event listeners
  Object.entries(confirmDialog.buttons).forEach(([key, button]) => {
    button.addEventListener("click", () => handleExitChoice(key));
    
    // Add hover effects for mouse interaction
    button.addEventListener("mouseenter", () => {
      state.confirmDialog.selectedButton = key;
      updateExitButtonHighlight();
    });
    
    button.addEventListener("mouseleave", () => {
      // Keep current selection, just update highlight
      updateExitButtonHighlight();
    });
  });
  
  // Click backdrop to cancel
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      handleExitChoice(isAuthenticated ? "cancel" : "no");
    }
  });
}

export function updateExitButtonHighlight() {
  if (!state.confirmDialog) return;
  
  // Clear all highlights using CSS classes
  Object.values(state.confirmDialog.buttons).forEach(btn => {
    btn.classList.remove("selected", "focused");
  });
  
  // Highlight selected button using CSS class
  const selectedBtn = state.confirmDialog.buttons[state.confirmDialog.selectedButton];
  if (selectedBtn) {
    selectedBtn.classList.add("selected");
  }
}

export function moveExitFocus(direction) {
  if (!state.confirmDialog) return;
  
  const buttonOrder = state.confirmDialog.buttonOrder;
  const currentIndex = buttonOrder.indexOf(state.confirmDialog.selectedButton);
  
  if (direction === "left" && currentIndex > 0) {
    state.confirmDialog.selectedButton = buttonOrder[currentIndex - 1];
  } else if (direction === "right" && currentIndex < buttonOrder.length - 1) {
    state.confirmDialog.selectedButton = buttonOrder[currentIndex + 1];
  } else if (direction === "up" && currentIndex > 0) {
    // For vertical navigation in the auth version
    state.confirmDialog.selectedButton = buttonOrder[currentIndex - 1];
  } else if (direction === "down" && currentIndex < buttonOrder.length - 1) {
    state.confirmDialog.selectedButton = buttonOrder[currentIndex + 1];
  }
  
  updateExitButtonHighlight();
}

export function handleExitChoice(choice) {
  if (!state.confirmDialog) return;
  
  const isAuthenticated = state.confirmDialog.isAuthenticated;
  
  if (isAuthenticated) {
    switch (choice) {
      case "logout":
        if (window.dashieAuth) {
          window.dashieAuth.signOut();
        }
        break;
      case "exit":
        if (window.dashieAuth) {
          window.dashieAuth.exitApp();
        } else {
          // Fallback exit behavior
          alert("Exiting Dashie...");
        }
        break;
      case "cancel":
        // Just close the dialog
        break;
    }
  } else {
    // Non-authenticated behavior (original functionality)
    if (choice === "yes") {
      alert("Exiting Dashie...");
      // In a real app, this would close the application
    }
  }
  
  // Remove dialog
  state.confirmDialog.element.remove();
  setConfirmDialog(null);
}
