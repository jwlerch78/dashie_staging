// widgets/calendar/calendar.js - UPDATED: TUI Calendar Widget with centralized data service
// Preserves all existing TUI Calendar functionality while using centralized Google Calendar data

class CalendarWidget {
  constructor() {
    // ============== CONFIG VARIABLES ==============
    this.MONTHS_TO_PULL = 3;
    this.GOOGLE_CALENDARS = [
      { summary: 'jwlerch@gmail.com', color: '#1976d2', textColor: '#ffffff' },
      { summary: 'Veeva', color: '#388e3c', textColor: '#ffffff' }
    ];

    // Create TUI Calendar configurations
    this.tuiCalendars = this.GOOGLE_CALENDARS.map((cal, index) => ({
      id: `google-cal-${index}`,
      name: cal.summary,
      backgroundColor: cal.color,
      borderColor: cal.color,
      color: cal.textColor
    }));

    this.calendar = null;
    this.currentView = 'week';
    this.currentDate = new Date();
    this.viewCycle = ['week', 'month', 'daily'];
    
    // NEW: Centralized data service state
    this.calendarData = {
      events: [],
      calendars: [],
      lastUpdated: null
    };
    this.isDataLoaded = false;
    this.connectionStatus = 'connecting';

    this.init();
  }

  init() {
    this.setupEventListeners();
    setTimeout(() => this.initializeCalendar(), 100);
  }

  setupEventListeners() {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.action) {
        this.handleCommand(event.data.action);
      }
      if (event.data && event.data.type) {
        this.handleDataServiceMessage(event.data);
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
        window.parent.postMessage({
          type: 'widget-ready',
          widget: 'calendar'
        }, '*');
      }
    });
  }

  handleDataServiceMessage(data) {
    switch (data.type) {
      case 'calendar-data-ready':
        console.log('📅 📨 Received calendar data from centralized service');
        this.handleCalendarData(data.data);
        break;
        
      case 'theme-change':
        console.log('📅 🎨 Received theme change:', data.theme);
        this.applyTheme(data.theme);
        break;
        
      case 'google-apis-ready':
        console.log('📅 🔗 Google APIs ready, requesting calendar data');
        setTimeout(() => this.requestCalendarData(), 1000);
        break;
    }
  }

  requestCalendarData() {
    console.log('📅 📤 Requesting calendar data from centralized service...');
    try {
      window.parent.postMessage({
        type: 'request-calendar-data',
        widget: 'calendar',
        timestamp: Date.now()
      }, '*');
      this.updateConnectionStatus('connecting');
    } catch (error) {
      console.error('📅 ❌ Failed to request calendar data:', error);
      this.updateConnectionStatus('error');
    }
  }

  handleCalendarData(data) {
    if (data.status === 'error') {
      console.error('📅 ❌ Calendar data error:', data.error);
      this.updateConnectionStatus('error');
      return;
    }

    this.calendarData = {
      events: data.events || [],
      calendars: data.calendars || [],
      lastUpdated: data.lastUpdated
    };

    this.isDataLoaded = true;
    this.updateConnectionStatus('connected');

    console.log(`📅 ✅ Calendar data loaded: ${this.calendarData.events.length} events`);

    this.loadEventsIntoCalendar();
  }

  loadEventsIntoCalendar() {
    if (!this.calendar || !this.isDataLoaded) {
      console.log('📅 ⏳ Calendar not ready or no data loaded yet');
      return;
    }

    // Clear existing events
    this.calendar.clear();

    const tuiEvents = [];

    this.calendarData.events.forEach((event, eventIndex) => {
      // Find matching calendar configuration
      let calendarConfig = null;
      let tuiCalendar = null;

      for (let i = 0; i < this.GOOGLE_CALENDARS.length; i++) {
        if (event.calendarName === this.GOOGLE_CALENDARS[i].summary) {
          calendarConfig = this.GOOGLE_CALENDARS[i];
          tuiCalendar = this.tuiCalendars[i];
          break;
        }
      }

      if (!calendarConfig) {
        calendarConfig = this.GOOGLE_CALENDARS[0];
        tuiCalendar = this.tuiCalendars[0];
      }

      // Determine if the event should be all-day
      const start = new Date(event.startDateTime);
      let end = new Date(event.endDateTime);

      let isAllDay = event.isAllDay || false;

      // New logic: same hour, different day → mark as all-day
      if (!isAllDay && start.getHours() === end.getHours() && start.toDateString() !== end.toDateString()) {
        isAllDay = true;
        // Adjust end date for TUI Calendar
        end = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      }

      const tuiEvent = {
        id: `event-${eventIndex}`,
        calendarId: tuiCalendar.id,
        title: event.summary || '(No title)',
        start: start,
        end: end,
        category: isAllDay ? 'allday' : 'time',
        backgroundColor: tuiCalendar.backgroundColor,
        borderColor: tuiCalendar.borderColor,
        color: tuiCalendar.color,
        raw: event
      };

      tuiEvents.push(tuiEvent);
    });

    if (tuiEvents.length > 0) {
      this.calendar.createEvents(tuiEvents);
      console.log(`📅 ✅ Loaded ${tuiEvents.length} events into TUI Calendar`);
    } else {
      console.log('📅 ℹ️ No events to display');
    }
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    const statusEl = document.querySelector('.status');
    if (statusEl) {
      switch (status) {
        case 'connected':
          statusEl.textContent = '●';
          statusEl.style.color = '#51cf66';
          break;
        case 'connecting':
          statusEl.textContent = '○';
          statusEl.style.color = '#ffaa00';
          break;
        case 'error':
          statusEl.textContent = '✕';
          statusEl.style.color = '#ff6b6b';
          break;
      }
    }
  }

  async initializeCalendar() {
    try {
      const monday = this.getStartOfWeek(this.currentDate);
      this.currentDate = monday;

      this.calendar = new tui.Calendar('#calendar', {
        defaultView: this.currentView,
        useCreationPopup: false,
        useDetailPopup: false,
        calendars: this.tuiCalendars,
        week: {
          startDayOfWeek: 1,
          dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          narrowWeekend: false,
          workweek: false,
          hourStart: 6,
          hourEnd: 24,
          showNowIndicator: true,
          eventView: ['time', 'allday'],
          taskView: false
        },
        month: {
          startDayOfWeek: 1,
          dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          visibleWeeksCount: 6,
          isAlways6Week: false,
          workweek: false
        },
        template: {
          time: (schedule) => {
            const calendar = this.tuiCalendars.find(cal => cal.id === schedule.calendarId);
            const textColor = calendar ? calendar.color : '#ffffff';
            return `<span style="color: ${textColor}; font-weight: 500;">${schedule.title}</span>`;
          }
        }
      });

      this.calendar.setDate(this.currentDate);
      this.showCalendar();
      this.updateCalendarHeader();

      console.log('📅 Requesting calendar data from centralized service...');
      this.requestCalendarData();

      setTimeout(() => this.scrollToTime(8), 200);

      console.log('📅 TUI Calendar initialized in', this.currentView, 'view');

    } catch (error) {
      console.error('📅 Failed to initialize calendar:', error);
      document.getElementById('loading').textContent = 'Failed to load calendar';
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

    const options = {
      year: 'numeric',
      month: 'long',
      ...(this.currentView === 'daily' ? { day: 'numeric' } : {})
    };

    titleEl.textContent = this.currentDate.toLocaleDateString('en-US', options);
    modeEl.textContent = this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1);
  }

  handleCommand(action) {
    console.log('📅 Calendar widget received command:', action);
    switch (action) {
      case 'right': 
      case 'next-view':
        this.navigateCalendar('next'); 
        break;
      case 'left': 
      case 'prev-view':
        this.navigateCalendar('previous'); 
        break;
      case 'up': 
        this.scrollCalendar('up'); 
        break;
      case 'down': 
        this.scrollCalendar('down'); 
        break;
      case 'enter': 
        console.log('📅 Enter pressed on calendar widget'); 
        break;
      case 'fastforward': 
      case 'ff': 
      case ',': 
        this.cycleView('forward'); 
        break;
      case 'rewind': 
      case 'rw': 
      case '.': 
        this.cycleView('backward'); 
        break;
      default: 
        console.log('📅 Calendar widget ignoring command:', action); 
        break;
    }
  }

  navigateCalendar(direction) {
    const currentDateObj = this.calendar.getDate();
    let newDate = new Date(currentDateObj);

    switch (this.currentView) {
      case 'daily': 
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1)); 
        break;
      case 'week': 
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7)); 
        break;
      case 'month': 
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1)); 
        break;
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
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  scrollCalendar(direction) {
    if (this.currentView === 'week' || this.currentView === 'daily') {
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper')
        || document.querySelector('.toastui-calendar-time');
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
      if (newView === 'week' || newView === 'daily') {
        setTimeout(() => this.scrollToTime(8), 100);
      }
    }
  }

  cycleView(direction) {
    const currentIndex = this.viewCycle.indexOf(this.currentView);
    const newIndex = direction === 'forward'
      ? (currentIndex + 1) % this.viewCycle.length
      : (currentIndex - 1 + this.viewCycle.length) % this.viewCycle.length;
    this.changeView(this.viewCycle[newIndex]);
  }

  applyTheme(theme) {
    const themeClass = `theme-${theme}`;
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.body.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(themeClass);
    document.body.classList.add(themeClass);
    console.log(`📅 Applied ${theme} theme to TUI Calendar`);
  }

  requestTheme() {
    try {
      window.parent.postMessage({
        type: 'widget-request-theme',
        widget: 'calendar'
      }, '*');
    } catch (error) {
      console.log('📅 Could not request theme');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const calendarWidget = new CalendarWidget();
  setTimeout(() => calendarWidget.requestTheme(), 500);
});
