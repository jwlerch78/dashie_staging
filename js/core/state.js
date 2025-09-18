// js/core/state.js - Global State Management
// CHANGE SUMMARY: Fixed widget URLs to use absolute paths for OAuth callback compatibility

// ---------------------
// APP STATE
// ---------------------

// DOM element references
export const elements = {
  grid: document.getElementById("grid"),
  sidebar: document.getElementById("sidebar")
};

// Widget URL mappings - FIXED: All paths now absolute
export const widgetUrls = {
  calendar: "/widgets/calendar.html",
  clock: "/widgets/clock.html", 
  location: "/widgets/location.html",
  map: "/widgets/map.html",
  agenda: "/widgets/agenda.html",
  photos: "/widgets/photos.html",
  camera: "/widgets/camera.html", // for future camera widget
  header: "/widgets/header.html"
};

// Widget layout configuration
export const widgets = [
  { id: "header", row: 1, col: 1, rowSpan: 1, colSpan: 1, url: widgetUrls.header },
  { id: "clock", row: 1, col: 2, rowSpan: 1, colSpan: 1, url: widgetUrls.clock },
  { id: "main", row: 2, col: 1, rowSpan: 2, colSpan: 1, url: widgetUrls.calendar }, 
  { id: "agenda", row: 2, col: 2, rowSpan: 1, colSpan: 1, url: widgetUrls.agenda },
  { id: "photos", row: 3, col: 2, rowSpan: 1, colSpan: 1, url: widgetUrls.photos }
];

// Map sidebar keys to main widget content
export const sidebarMapping = {
  calendar: "📅 Calendar",
  map: "🗺️ Map",
  camera: "📷 Camera"
};

// Mutable application state
export const state = {
  currentMain: "calendar", // default main widget
  focus: { type: "grid", row: 1, col: 1 }, // current focus for D-pad navigation
  selectedCell: null, // focused widget
  isAsleep: false, // sleep mode state
  confirmDialog: null, // exit confirmation dialog state
  widgetReadyStatus: new Map() // track which widgets are ready
};

// ---------------------
// STATE HELPERS
// ---------------------

export function setFocus(newFocus) {
  state.focus = newFocus;
}

export function setSelectedCell(cell) {
  state.selectedCell = cell;
}

export function setCurrentMain(mainType) {
  state.currentMain = mainType;
  
  // Update the main widget's URL when switching content
  const mainWidget = widgets.find(w => w.id === "main");
  if (mainWidget && widgetUrls[mainType]) {
    mainWidget.url = widgetUrls[mainType];
    mainWidget.label = sidebarMapping[mainType] || mainWidget.label;
  }
}

export function setSleepMode(sleeping) {
  state.isAsleep = sleeping;
}

export function setConfirmDialog(dialog) {
  state.confirmDialog = dialog;
}

export function setWidgetReady(widgetId, ready = true) {
  state.widgetReadyStatus.set(widgetId, ready);
}

export function isWidgetReady(widgetId) {
  return state.widgetReadyStatus.get(widgetId) || false;
}

export function findWidget(row, col) {
  return widgets.find(w => w.row === row && w.col === col);
}
