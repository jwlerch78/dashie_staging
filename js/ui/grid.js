// js/ui/grid.js - Widget Grid & Sidebar Rendering with Theme Support (Fixed sidebarOptions)
// CHANGE SUMMARY: Fixed all icon and logo paths to use absolute paths for OAuth callback compatibility

import { state, elements, widgets, sidebarMapping, setFocus } from '../core/state.js';

// FIXED: Add sidebarOptions definition with absolute icon paths
const sidebarOptions = [
  // Main content selection items (larger, always visible)
  { id: "calendar", type: "main", iconSrc: "/icons/icon-calendar.svg", label: "Calendar" },
  { id: "map", type: "main", iconSrc: "/icons/icon-map.svg", label: "Location Map" },
  { id: "camera", type: "main", iconSrc: "/icons/icon-video-camera.svg", label: "Camera Feed" },
  
  // System function items (smaller, in mini-grid)
  { id: "reload", type: "system", iconSrc: "/icons/icon-reload.svg", label: "Reload" },
  { id: "sleep", type: "system", iconSrc: "/icons/icon-sleep.svg", label: "Sleep" },
  { id: "settings", type: "system", iconSrc: "/icons/icon-settings.svg", label: "Settings" },
  { id: "exit", type: "system", iconSrc: "/icons/icon-exit.svg", label: "Exit" }
];

// ---------------------
// WIDGET CREATION
// ---------------------

function createWidgetIframe(widget) {
  const iframe = document.createElement("iframe");
  iframe.src = widget.url || "about:blank";
  iframe.className = "widget-iframe";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  
  // Prevent iframe from stealing focus when sidebar is expanded
  iframe.addEventListener("focus", (e) => {
    if (elements.sidebar.classList.contains("expanded")) {
      e.preventDefault();
      iframe.blur();
    }
  });
  
  // Add load event listener and apply theme when widget loads
  iframe.addEventListener("load", () => {
    // Apply current theme to newly loaded widget
    import('../core/theme.js').then(({ applyThemeToWidget }) => {
      applyThemeToWidget(iframe);
    }).catch(() => {
      // Theme module not available, continue
    });
  });
  
  // Add error handling
  iframe.addEventListener("error", () => {
    console.warn(`Widget iframe failed to load: ${widget.id}`);
  });
  
  return iframe;
}

function createFallbackWidget(widget) {
  const fallback = document.createElement("div");
  fallback.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #444;
    color: #999;
    font-size: 14px;
    text-align: center;
    padding: 20px;
    box-sizing: border-box;
    flex-direction: column;
  `;
  fallback.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 10px;">${widget.label}</div>
    <div>Widget not available</div>
    <div style="font-size: 12px; margin-top: 10px; color: #777;">URL: ${widget.url || 'No URL'}</div>
  `;
  return fallback;
}

// ---------------------
// GRID RENDERING
// ---------------------

export function renderGrid() {
  elements.grid.innerHTML = "";
  
  widgets.forEach(w => {
    const div = document.createElement("div");
    div.classList.add("widget");
    div.dataset.row = w.row;
    div.dataset.col = w.col;
    div.style.gridRow = `${w.row} / span ${w.rowSpan}`;
    div.style.gridColumn = `${w.col} / span ${w.colSpan}`;
    div.style.position = "relative";

    // Create click overlay that sits on top of iframe
    const clickOverlay = document.createElement("div");
    clickOverlay.className = "widget-click-overlay";
    clickOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
      pointer-events: none;
      background: transparent;
    `;

    // Function to enable/disable click overlay based on sidebar state
    const updateOverlay = () => {
      const sidebarExpanded = elements.sidebar.classList.contains("expanded");
      clickOverlay.style.pointerEvents = sidebarExpanded ? "auto" : "none";
    };

    // Click handler on overlay (intercepts clicks when sidebar is expanded)
    clickOverlay.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Close sidebar if expanded
      if (elements.sidebar.classList.contains("expanded")) {
        elements.sidebar.classList.remove("expanded");
        
        // Return focus to this specific widget
        if (state.focus.type === "menu") {
          import('../core/navigation.js').then(({ updateFocus }) => {
            setFocus({ type: "grid", row: w.row, col: w.col });
            updateFocus();
          });
        }
      }
      
      // Update overlay state after sidebar change
      setTimeout(updateOverlay, 10);
    });

    // Monitor sidebar state changes with MutationObserver
    const observer = new MutationObserver(() => updateOverlay());
    observer.observe(elements.sidebar, { attributes: true, attributeFilter: ['class'] });

    // Create iframe or fallback for widget content
    if (w.url) {
      const iframe = createWidgetIframe(w);
      div.appendChild(iframe);
    } else {
      const fallback = createFallbackWidget(w);
      div.appendChild(fallback);
    }

    // Add overlay on top of content
    div.appendChild(clickOverlay);
    
    // Set initial overlay state
    updateOverlay();

    elements.grid.appendChild(div);
  });
}

// ---------------------
// SIDEBAR RENDERING
// ---------------------

export function renderSidebar() {
  elements.sidebar.innerHTML = "";

  // Add Dashie logo (only visible when expanded) - FIXED: Absolute paths
  const logo = document.createElement("img");
  logo.classList.add("dashie-logo");
  logo.alt = "Dashie";
  
  // Set logo source based on current theme immediately with absolute paths
  import('../core/theme.js').then(({ getCurrentTheme }) => {
    const currentTheme = getCurrentTheme();
    const logoSrc = currentTheme === 'light' 
      ? '/icons/Dashie_Full_Logo_Black_Transparent.png'
      : '/icons/Dashie_Full_Logo_White_Transparent.png';
    logo.src = logoSrc;
  }).catch(() => {
    // Fallback if theme system isn't loaded yet - using absolute path
    logo.src = '/icons/Dashie_Full_Logo_White_Transparent.png';
  });
  
  elements.sidebar.appendChild(logo);

  // Separate main and system items
  const mainItems = sidebarOptions.filter(item => item.type === "main");
  const systemItems = sidebarOptions.filter(item => item.type === "system");

  // Create main items (content selection)
  mainItems.forEach((item, index) => {
    const div = createMenuItem(item, "main", index);
    elements.sidebar.appendChild(div);
  });

  // Add separator
  const separator = document.createElement("div");
  separator.classList.add("menu-separator");
  elements.sidebar.appendChild(separator);

  // Create system functions container (2x2 grid)
  const systemContainer = document.createElement("div");
  systemContainer.classList.add("system-functions");

  systemItems.forEach((item, index) => {
    const div = createMenuItem(item, "system", index + mainItems.length);
    systemContainer.appendChild(div);
  });

  elements.sidebar.appendChild(systemContainer);
}

// ---------------------
// MENU ITEM CREATION
// ---------------------

export function createMenuItem(item, type, globalIndex) {
  const div = document.createElement("div");
  div.classList.add("menu-item", type);
  div.dataset.menu = item.id;
  div.dataset.globalIndex = globalIndex;

  // Highlight active main widget
  if (["calendar","map","camera"].includes(item.id) && item.id === state.currentMain) {
    div.classList.add("active");
  }

  // Icon - using CSS class instead of inline styles (iconSrc already has absolute path)
  const img = document.createElement("img");
  img.src = item.iconSrc;
  img.classList.add("menu-icon");
  div.appendChild(img);

  // Label text (hidden by default, shown when expanded)
  const label = document.createElement("span");
  label.classList.add("menu-label");
  label.textContent = item.label || "";
  div.appendChild(label);

  // Add event listeners
  addMenuItemEventListeners(div, type, globalIndex);

  return div;
}

// ---------------------
// EVENT LISTENERS
// ---------------------

function addMenuItemEventListeners(div, type, globalIndex) {
  let touchStartTime = 0;
  let touchTimeout = null;
  
  // Mouse hover events (unchanged)
  div.addEventListener("mouseover", () => {
    if (state.confirmDialog || state.isAsleep || state.selectedCell) return;
    setFocus({ type: "menu", index: globalIndex });
    elements.sidebar.classList.add("expanded");
    
    import('../core/navigation.js').then(({ updateFocus }) => updateFocus());
  });

  div.addEventListener("mouseout", () => {
    if (state.confirmDialog || state.isAsleep || state.selectedCell) return;
    if (state.focus.type !== "menu") elements.sidebar.classList.remove("expanded");
  });

  // Touch events for better mobile/touchscreen handling
  div.addEventListener("touchstart", (e) => {
    if (state.confirmDialog || state.isAsleep) return;
    touchStartTime = Date.now();
    
    // Prevent default to avoid mouse events firing
    e.preventDefault();
    
    // Don't allow menu touches when widget is focused
    if (state.selectedCell) return;
    
    // Set focus immediately on touch start
    setFocus({ type: "menu", index: globalIndex });
    
    // For system items, expand the menu but don't execute yet
    if (type === "system") {
      elements.sidebar.classList.add("expanded");
      import('../core/navigation.js').then(({ updateFocus }) => updateFocus());
    }
  });

  div.addEventListener("touchend", (e) => {
    if (state.confirmDialog || state.isAsleep) return;
    
    const touchDuration = Date.now() - touchStartTime;
    
    // Only treat as a tap if touch was brief (less than 300ms)
    if (touchDuration < 300) {
      e.preventDefault();
      
      if (state.selectedCell) return;
      
      import('../core/navigation.js').then(({ updateFocus, handleEnter }) => {
        // Small delay to show expansion, then execute
        if (type === "system") {
          setTimeout(() => handleEnter(), 150);
        } else {
          handleEnter();
        }
      });
    }
  });

  // Click events (for mouse/non-touch)
  div.addEventListener("click", (e) => {
    if (state.confirmDialog || state.isAsleep) return;
    
    // Skip if this was a touch event (touchend will handle it)
    if (e.pointerType === 'touch' || touchStartTime > 0) {
      touchStartTime = 0; // Reset for next interaction
      return;
    }
    
    if (state.selectedCell) return;
    
    setFocus({ type: "menu", index: globalIndex });
    
    import('../core/navigation.js').then(({ updateFocus, handleEnter }) => {
      if (type === "system") {
        elements.sidebar.classList.add("expanded");
        updateFocus();
        setTimeout(() => handleEnter(), 150);
      } else {
        handleEnter();
      }
    });
  });
}
