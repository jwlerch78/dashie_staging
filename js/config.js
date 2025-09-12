// ****************
// config.js
//*****************

// supabase dev and prod configuration
const dbConfig = {
    production: {
        supabaseUrl: 'https://cseaywxcvnxcsypaqaid.supabase.co',
        supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZWF5d3hjdm54Y3N5cGFxYWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MDIxOTEsImV4cCI6MjA3MzE3ODE5MX0.Wnd7XELrtPIDKeTcHVw7dl3awn3BlI0z9ADKPgSfHhA',
        environment: 'production'
    },
    development: {
        supabaseUrl: 'https://cwglbtosingboqepsmjk.supabase.co', 
        supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Z2xidG9zaW5nYm9xZXBzbWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NDY4NjYsImV4cCI6MjA3MzIyMjg2Nn0.VCP5DSfAwwZMjtPl33bhsixSiu_lHsM6n42FMJRP3YA',
        environment: 'development'
    }
};

// Auto-detect environment based on domain
const getCurrentDbConfig = () => {
    if (window.location.hostname.includes('dev.')) {
        return dbConfig.development;
    }
    return dbConfig.production;
};

const currentDbConfig = getCurrentDbConfig();

// Export for use in other files
window.currentDbConfig = currentDbConfig;








// Theme + configuration
const theme = {
  sidebarBg: "#222",
  iconColor: "white",
  selectedOutline: "yellow",
  focusedOutline: "cyan"
};

const sidebarOptions = [
  // Main content selection items (larger, always visible)
  { id: "calendar", type: "main", iconSrc: "icons/icon-calendar.svg", label: "Calendar" },
  { id: "map", type: "main", iconSrc: "icons/icon-map.svg", label: "Location Map" },
  { id: "camera", type: "main", iconSrc: "icons/icon-video-camera.svg", label: "Camera Feed" },
  
  // System function items (smaller, in mini-grid)
  { id: "reload", type: "system", iconSrc: "icons/icon-reload.svg", label: "Reload" },
  { id: "sleep", type: "system", iconSrc: "icons/icon-sleep.svg", label: "Sleep" },
  { id: "settings", type: "system", iconSrc: "icons/icon-settings.svg", label: "Settings" },
  { id: "exit", type: "system", iconSrc: "icons/icon-exit.svg", label: "Exit" }
];


//******************
// Traccar proxy URL
//******************
const PROXY_URL = "https://traccar-proxy-fcj3.onrender.com";

// Devices
const DEVICES = [
  { id: 1, name: "Dad", img: "https://raw.githubusercontent.com/jwlerch78/family_calendar/main/images/Dad.png" },
  { id: 2, name: "Mom", img: "https://raw.githubusercontent.com/jwlerch78/family_calendar/main/images/Mom.png" },
  { id: 3, name: "Charlie", img: "https://raw.githubusercontent.com/jwlerch78/family_calendar/main/images/Char.png" },
  { id: 4, name: "Jack", img: "https://raw.githubusercontent.com/jwlerch78/family_calendar/main/images/Jack.png" },
  { id: 5, name: "Mary", img: "https://raw.githubusercontent.com/jwlerch78/family_calendar/main/images/Mary.png" }
];

const HOME_LOCATION = { lat: 27.93241, lon: -82.81062 }; // your home coordinates

// Zones
const ZONES = [
  //{ name: "Home", lat: 27.93241, lon: -82.81062, radius: 0.002 },
  //{ name: "Osceola HS", lat: 27.9150, lon: -82.7800, radius: 0.002 },
  //{ name: "Soccer Field", lat: 27.9200, lon: -82.7700, radius: 0.002 },
  { name: "Home",        lat: 27.93241,      lon: -82.81062,     radius: 0.003 }, // ~110 m
  { name: "Osceola HS",  lat: 27.8616,       lon: -82.7711,      radius: 0.004 }, // ~440 m
  { name: "CFMS",        lat: 27.977,        lon: -82.765948,    radius: 0.004 },
  { name: "Auntie's",    lat: 27.9568,       lon: -82.80285,     radius: 0.003 },
  { name: "IRCS",        lat: 27.8832,       lon: -82.81443,     radius: 0.004 },
  { name: "TBU",         lat: 28.08333,      lon: -82.6080,      radius: 0.004 },
  { name: "SJ",          lat: 27.8775866,    lon: -82.814629,    radius: 0.004 },
  { name: "Belleair Rec",lat: 27.9351627598, lon: -82.80202,     radius: 0.003 },
  { name: "Sam's",       lat: 27.95929,      lon: -82.7317,      radius: 0.003 },
  { name: "Publix",      lat: 27.9166,       lon: -82.8135976,   radius: 0.003 },
  { name: "Molly's",     lat: 28.0023296,    lon: -82.76779518,  radius: 0.003 },
  { name: "Julia's",     lat: 28.071224355,  lon: -82.682356,    radius: 0.003 },
  { name: "Belcher",     lat: 27.89895,      lon: -82.74484,     radius: 0.004 },
  { name: "Carlouel",    lat: 28.006,        lon: -82.826,       radius: 0.004 },
  { name: "The Break",   lat: 27.922,     lon: -82.8145,     radius: 0.003} 
  
];
