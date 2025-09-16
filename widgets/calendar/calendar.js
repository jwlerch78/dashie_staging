// widgets/calendar.html - Fixed to listen for postMessage instead of window event
// FIXED: Updated waitForGoogleAPI to listen for postMessage from auth manager

import { GoogleAPIClient } from '../../js/google-apis/google-api-client.js';

class CalendarWidget {
  constructor() {
    // ================= CONFIG =================
    this.MONTHS_TO_PULL = 3;
    this.GOOGLE_CALENDARS = [
      { summary: 'jwlerch@gmail.com', color: '#1976d2', textColor: '#ffffff', id: 'calendar1', backgroundColor: '#1976d2', borderColor: '#1976d2' },
      { summary: 'Veeva', color: '#388e3c', textColor: '#ffffff', id: 'calendar2', backgroundColor: '#388e3c', borderColor: '#388e3c' }
    ];
    this.tuiCalendars = this.GOOGLE_CALENDARS.map(cal => ({
      id: cal.id,
      name: cal.summary,
      color: cal.textColor,
      backgroundColor: cal.backgroundColor,
      borderColor: cal.borderColor
    }));
    this.calendar = null;
    this.currentView = 'week';
    this.currentDate = new Date();
    this.viewCycle = ['week', 'month', 'daily'];
    // ================= INIT =================
    this.setupEventListeners();
    this.initializeCalendar();
    this.waitForGoogleAPI();
  }

  setupEventListeners() {
    window.addEventListener('message', (event) => {
      // FIXED: Handle both navigation commands AND google-apis-ready
      if (event.data && event.data.action) {
        this.handleCommand(event.data.action);
      } else if (event.data && event.data.type === 'google-apis-ready') {
        // FIXED: Handle google-apis-ready via postMessage
        this.handleGoogleAPIReady(event.data);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (document.hasFocus()) {
        switch (e.key) {
          case ',':
            e.preventDefault();
            this.cycleView('forward');
            break;
          case '.':
            e.preventDefault();
            this.cycleView('backward');
            break;
        }
      }
    });

    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'widget-ready', widget: 'calendar' }, '*');
      }
    });
  }

  // FIXED: Replace waitForGoogleAPI with direct postMessage handler
  waitForGoogleAPI() {
    console.log('📅 Calendar widget waiting for Google APIs ready signal...');
    // The actual handling is now in setupEventListeners() -> 'google-apis-ready' case
  }

  // NEW: Handle the google-apis-ready postMessage
  async handleGoogleAPIReady(messageData) {
    console.log('📅 🎉 Received google-apis-ready postMessage:', messageData);
    console.log('📅 API Capabilities:', messageData.apiCapabilities);
    
    // Check if calendar API is available
    if (messageData.apiCapabilities && messageData.apiCapabilities.calendar) {
      console.log('📅 ✅ Calendar API is ready, loading Google calendar data...');
      
      if (typeof this.loadGoogleCalendarData === 'function') {
        try {
          await this.loadGoogleCalendarData();
          console.log('📅 ✅ Google calendar data loaded successfully');
        } catch (error) {
          console.error('📅 ❌ Failed to load Google calendar data:', error);
        }
      } else {
        console.warn('📅 ⚠️ loadGoogleCalendarData method not found');
      }
    } else {
      console.warn('📅 ⚠️ Calendar API not available:', {
        hasApiCapabilities: !!messageData.apiCapabilities,
        calendarStatus: messageData.apiCapabilities?.calendar,
        tokenStatus: messageData.apiCapabilities?.tokenStatus,
        errors: messageData.apiCapabilities?.errors
      });
      
      // Show error message to user
      this.showCalendarError('Google Calendar API is not available. Please check your authentication.');
    }
  }

  // NEW: Show error message in calendar widget
  showCalendarError(message) {
    const calendarContainer = document.getElementById('calendar');
    if (calendarContainer) {
      calendarContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; text-align: center; padding: 20px;">
          <div>
            <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
            <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Calendar Unavailable</div>
            <div style="font-size: 14px;">${message}</div>
          </div>
        </div>
      `;
    }
  }


  showCalendar() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('calendarHeader').style.display = 'flex';
    document.getElementById('calendar').style.display = 'block';
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  updateCalendarHeader() {
    const titleEl = document.getElementById('calendarTitle');
    const modeEl = document.getElementById('calendarMode');
    const options = { year: 'numeric', month: 'long', ...(this.currentView === 'daily' ? { day: 'numeric' } : {}) };
    titleEl.textContent = this.currentDate.toLocaleDateString('en-US', options);
    modeEl.textContent = this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1);
  }

  handleCommand(action) {
    switch (action) {
      case 'right': this.navigateCalendar('next'); break;
      case 'left': this.navigateCalendar('previous'); break;
      case 'up': this.scrollCalendar('up'); break;
      case 'down': this.scrollCalendar('down'); break;
      case 'enter': break;
      case 'fastforward': case 'ff': case ',': this.cycleView('forward'); break;
      case 'rewind': case 'rw': case '.': this.cycleView('backward'); break;
    }
  }

  navigateCalendar(direction) {
    const currentDateObj = this.calendar.getDate();
    let newDate = new Date(currentDateObj);
    switch (this.currentView) {
      case 'daily': newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1)); break;
      case 'week': newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7)); break;
      case 'month': newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1)); break;
    }
    this.currentDate = newDate;
    this.calendar.setDate(newDate);
    this.updateCalendarHeader();
  }

  scrollToTime(hour) {
    if (this.currentView === 'week' || this.currentView === 'daily') {
      const timeElements = document.querySelectorAll('.toastui-calendar-time-hour');
      const targetElement = Array.from(timeElements).find(el => {
        const hourText = el.textContent || el.innerText;
        return hourText.includes(hour + ':00') || hourText.includes((hour % 12 || 12) + ':00');
      });
      if (targetElement) targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollCalendar(direction) {
    if (this.currentView === 'week' || this.currentView === 'daily') {
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper') || document.querySelector('.toastui-calendar-time');
      if (scrollContainer) {
        const scrollAmount = 60;
        scrollContainer.scrollTop += (direction === 'up' ? -scrollAmount : scrollAmount);
      }
    }
  }

  changeView(newView) {
    if (this.viewCycle.includes(newView)) {
      this.currentView = newView;
      this.calendar.changeView(newView);
      this.updateCalendarHeader();
      if (newView === 'week' || newView === 'daily') setTimeout(() => this.scrollToTime(8), 100);
    }
  }

  cycleView(direction) {
    const currentIndex = this.viewCycle.indexOf(this.currentView);
    const newIndex = direction === 'forward'
      ? (currentIndex + 1) % this.viewCycle.length
      : (currentIndex - 1 + this.viewCycle.length) % this.viewCycle.length;
    this.changeView(this.viewCycle[newIndex]);
  }

  async loadGoogleCalendarData() {
    if (!window.authManager) {
      console.warn('📅 Google authManager not ready, skipping event load');
      return;
    }

    console.log('📅 Loading Google Calendar data...');
    const api = new GoogleAPIClient(window.authManager);
    const timeMin = new Date().toISOString();
    const timeMax = (() => { const d = new Date(); d.setMonth(d.getMonth() + this.MONTHS_TO_PULL); return d.toISOString(); })();

    for (let i = 0; i < this.GOOGLE_CALENDARS.length; i++) {
      const cal = this.GOOGLE_CALENDARS[i];
      try {
        const allCals = await api.getCalendarList();
        const matching = allCals.find(c => c.summary === cal.summary);
        if (!matching) { console.warn(`Calendar ${cal.summary} not found`); continue; }

        const events = await api.getCalendarEvents(matching.id, timeMin, timeMax);
        const tuiEvents = events.map((e, idx) => ({
          id: `${matching.id}-${idx}`,
          calendarId: this.tuiCalendars[i].id,
          title: e.summary || '(No title)',
          start: new Date(e.startDateTime),
          end: new Date(e.endDateTime),
          category: e.isAllDay ? 'allday' : 'time',
          backgroundColor: this.tuiCalendars[i].backgroundColor,
          borderColor: this.tuiCalendars[i].borderColor,
          color: this.tuiCalendars[i].color
        }));

        this.calendar.createEvents(tuiEvents);
        console.log(`📅 Loaded ${tuiEvents.length} events for ${cal.summary}`);
      } catch (err) {
        console.error(`📅 Failed to load Google events for ${cal.summary}:`, err);
      }
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => new CalendarWidget());
