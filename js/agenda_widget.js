// agenda_widget.js
document.addEventListener("DOMContentLoaded", function() {
  // --- Elements ---
  const agendaFrame = document.getElementById("agenda-frame");

  // --- Agenda Setup ---
  const baseUrl = "https://calendar.google.com/calendar/embed?ctz=America/New_York&showTitle=0&showNav=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&mode=AGENDA&showDate=0";
  const calendars = AGENDA_CALENDARS;

  // --- Agenda Scroll Variables ---
  let agendaScrollY = 0; // Current scroll position
  const scrollStep = 100; // How much to scroll each time
  const maxScroll = 0; // Top position
  const minScroll = -1700; // Maximum scroll down (adjust based on content)

  // --- Build Agenda URL ---
  function buildAgendaUrl() {
    const today = new Date();
    const startDate = today.toISOString().slice(0,10).replace(/-/g,'');
    const endDateObj = new Date(today);
    endDateObj.setDate(today.getDate() + 4);
    const endDate = endDateObj.toISOString().slice(0,10).replace(/-/g,'');
    
    let fullUrl = baseUrl + `&dates=${startDate}T000000/${endDate}T235959`;
    calendars.forEach(cal => {
      fullUrl += `&src=${encodeURIComponent(cal.id)}&color=${cal.color}`;
    });
    return fullUrl;
  }

  // --- Initialize Agenda ---
  function initializeAgenda() {
    const fullUrl = buildAgendaUrl();
    agendaFrame.src = fullUrl;
    
    // Auto-refresh every 15 minutes
    setInterval(() => {
      agendaFrame.src = fullUrl + "&t=" + Date.now();
    }, 900000);
  }

  // --- Update Agenda Transform ---
  function updateAgendaTransform() {
    // Combine the scale and translateY transforms
    agendaFrame.style.transform = `scale(0.8) translateY(${agendaScrollY}px)`;
  }


  // --- Message Handler for Navigation ---
  window.addEventListener('message', (event) => {
    const { action, mode } = event.data || {};
    // if (mode !== "agenda_widget") return; // Only respond when agenda widget is selected

    switch(action) {
      case "Up":
        // Scroll agenda up
        agendaScrollY = Math.min(agendaScrollY + scrollStep, maxScroll);
        updateAgendaTransform();
        break;
        
      case "Down":
        // Scroll agenda down
        agendaScrollY = Math.max(agendaScrollY - scrollStep, minScroll);
        updateAgendaTransform();
        break;
        
    }
  });

  // --- Initialize Everything ---
  initializeAgenda();
});
