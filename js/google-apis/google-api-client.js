// js/google-apis/google-api-client.js - UPDATED: Enhanced for centralized data fetching with better error handling and caching support
// Enhanced production data fetching, better error handling, retry logic, and optimized API calls

// ==================== CONFIG VARIABLES ====================

// How many months ahead to pull events
const MONTHS_TO_PULL = 3;

// Calendars to include by summary (name/email as shown in calendar list)
const CALENDARS_TO_INCLUDE = [
  "jwlerch@gmail.com",
  "Veeva"
];

// ==================== GOOGLE API CLIENT ====================

export class GoogleAPIClient {
  constructor(authManager) {
    this.authManager = authManager;
    this.baseUrl = 'https://www.googleapis.com';
    
    // NEW: Request retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000  // 10 seconds
    };
    
    // NEW: Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
  }

  // Get current access token from auth manager
  getAccessToken() {
    return this.authManager.getGoogleAccessToken();
  }

  // NEW: Rate-limited request wrapper
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  // NEW: Enhanced request method with retry logic and better error handling
  async makeRequest(endpoint, options = {}) {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('No Google access token available');
    }

    let url;
    if (endpoint.startsWith('http')) {
      url = endpoint;
    } else if (endpoint.startsWith('/v1/')) {
      // Photos API endpoints use photoslibrary domain
      url = `https://photoslibrary.googleapis.com${endpoint}`;
    } else {
      // Other APIs use standard domain
      url = `${this.baseUrl}${endpoint}`;
    }    

    const requestOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // NEW: Retry logic with exponential backoff
    let lastError;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Apply rate limiting
        await this.waitForRateLimit();
        
        console.log(`📡 Google API request (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}): ${url}`);
        
        const response = await fetch(url, requestOptions);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Google API request successful on attempt ${attempt + 1}`);
          return data;
        }
        
        // Handle specific error codes
        const errorText = await response.text();
        const error = new Error(`Google API request failed: ${response.status} - ${errorText}`);
        error.status = response.status;
        error.response = response;
        
        // Don't retry on certain errors
        if (response.status === 401 || response.status === 403) {
          console.error(`❌ Google API authentication error (${response.status}):`, errorText);
          throw error;
        }
        
        // For 5xx errors or rate limits, we'll retry
        if (response.status >= 500 || response.status === 429) {
          lastError = error;
          console.warn(`⚠️ Google API error ${response.status} on attempt ${attempt + 1}, will retry:`, errorText);
          
          if (attempt < this.retryConfig.maxRetries) {
            const delay = Math.min(
              this.retryConfig.baseDelay * Math.pow(2, attempt),
              this.retryConfig.maxDelay
            );
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // For other errors, don't retry
        throw error;
        
      } catch (error) {
        lastError = error;
        
        // If it's a network error, retry
        if (error.name === 'TypeError' || error.message.includes('fetch')) {
          console.warn(`⚠️ Network error on attempt ${attempt + 1}:`, error.message);
          
          if (attempt < this.retryConfig.maxRetries) {
            const delay = Math.min(
              this.retryConfig.baseDelay * Math.pow(2, attempt),
              this.retryConfig.maxDelay
            );
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // If it's not a retryable error, throw immediately
        throw error;
      }
    }
    
    console.error(`❌ Google API request failed after ${this.retryConfig.maxRetries + 1} attempts`);
    throw lastError;
  }

  // ====================
  // GOOGLE PHOTOS METHODS
  // ====================

  async getPhotoAlbums() {
    console.log('📸 Fetching Google Photos albums...');
    
    try {
      const response = await this.makeRequest('/v1/albums', {
        method: 'GET'
      });
      
      const albums = response.albums || [];
      console.log(`📸 ✅ Found ${albums.length} photo albums`);
      
      return albums.map(album => ({
        id: album.id,
        title: album.title,
        productUrl: album.productUrl,
        mediaItemsCount: album.mediaItemsCount || 0,
        coverPhotoBaseUrl: album.coverPhotoBaseUrl,
        isWriteable: album.isWriteable || false
      }));
      
    } catch (error) {
      console.error('📸 ❌ Failed to fetch photo albums:', error);
      
      // Return empty array instead of throwing to prevent breaking the dashboard
      return [];
    }
  }

  async getAlbumPhotos(albumId, pageSize = 50, pageToken = null) {
    console.log(`📸 Fetching photos from album: ${albumId}`);
    
    try {
      const requestBody = {
        albumId: albumId,
        pageSize: pageSize
      };
      
      if (pageToken) {
        requestBody.pageToken = pageToken;
      }

      const response = await this.makeRequest('/v1/mediaItems:search', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      const mediaItems = response.mediaItems || [];
      console.log(`📸 ✅ Found ${mediaItems.length} photos in album`);
      
      return {
        photos: mediaItems.map(item => ({
          id: item.id,
          filename: item.filename,
          baseUrl: item.baseUrl,
          mimeType: item.mimeType,
          creationTime: item.mediaMetadata?.creationTime,
          width: item.mediaMetadata?.width,
          height: item.mediaMetadata?.height,
          displayUrl: `${item.baseUrl}=w1920-h1080-c`,
          thumbnailUrl: `${item.baseUrl}=w300-h300-c`
        })),
        nextPageToken: response.nextPageToken
      };
      
    } catch (error) {
      console.error(`📸 ❌ Failed to fetch photos from album ${albumId}:`, error);
      return { photos: [], nextPageToken: null };
    }
  }

  async getRecentPhotos(pageSize = 50, pageToken = null) {
    console.log('📸 Fetching recent photos...');
    
    try {
      const requestBody = {
        pageSize: pageSize,
        filters: {
          mediaTypeFilter: {
            mediaTypes: ['PHOTO']
          }
        }
      };
      
      if (pageToken) {
        requestBody.pageToken = pageToken;
      }

      const response = await this.makeRequest('/v1/mediaItems:search', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      const mediaItems = response.mediaItems || [];
      console.log(`📸 ✅ Found ${mediaItems.length} recent photos`);
      
      return {
        photos: mediaItems.map(item => ({
          id: item.id,
          filename: item.filename,
          baseUrl: item.baseUrl,
          mimeType: item.mimeType,
          creationTime: item.mediaMetadata?.creationTime,
          width: item.mediaMetadata?.width,
          height: item.mediaMetadata?.height,
          displayUrl: `${item.baseUrl}=w1920-h1080-c`,
          thumbnailUrl: `${item.baseUrl}=w300-h300-c`
        })),
        nextPageToken: response.nextPageToken
      };
      
    } catch (error) {
      console.error('📸 ❌ Failed to fetch recent photos:', error);
      return { photos: [], nextPageToken: null };
    }
  }

  // ====================
  // GOOGLE CALENDAR METHODS
  // ====================

  async getCalendarList() {
    console.log('📅 Fetching Google Calendar list...');
    
    try {
      const response = await this.makeRequest('/calendar/v3/users/me/calendarList');
      
      const calendars = response.items || [];
      console.log(`📅 ✅ Found ${calendars.length} calendars`);
      
      return calendars.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
        accessRole: cal.accessRole,
        selected: cal.selected,
        timeZone: cal.timeZone
      }));
      
    } catch (error) {
      console.error('📅 ❌ Failed to fetch calendar list:', error);
      throw error; // Re-throw for testAccess to catch properly
    }
  }

  async getCalendarEvents(calendarId, timeMin = null, timeMax = null, maxResults = 250) {
    console.log(`📅 Fetching events from calendar: ${calendarId}`);
    
    try {
      const params = new URLSearchParams({
        maxResults: maxResults.toString(),
        singleEvents: 'true',
        orderBy: 'startTime'
      });
      
      if (!timeMin) {
        timeMin = new Date().toISOString();
      }
      if (!timeMax) {
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + MONTHS_TO_PULL);
        timeMax = maxDate.toISOString();
      }
      
      params.append('timeMin', timeMin);
      params.append('timeMax', timeMax);
      
      const response = await this.makeRequest(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
      
      const events = response.items || [];
      console.log(`📅 ✅ Found ${events.length} events in calendar: ${calendarId}`);
      
      return events.map(event => ({
        id: event.id,
        summary: event.summary || 'No title',
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location,
        attendees: event.attendees || [],
        creator: event.creator,
        organizer: event.organizer,
        status: event.status,
        htmlLink: event.htmlLink,
        calendarId: calendarId,
        isAllDay: !!event.start.date,
        startDateTime: event.start.dateTime || event.start.date,
        endDateTime: event.end.dateTime || event.end.date
      }));
      
    } catch (error) {
      console.error(`📅 ❌ Failed to fetch events from calendar ${calendarId}:`, error);
      return [];
    }
  }

  // NEW: Enhanced getAllCalendarEvents with better error handling and performance
  async getAllCalendarEvents(timeMin = null, timeMax = null) {
    console.log('📅 🚀 Fetching events from all configured calendars...');
    
    try {
      // First, get the calendar list
      const calendars = await this.getCalendarList();
      
      // Filter calendars by our config list
      const filteredCalendars = calendars.filter(cal =>
        CALENDARS_TO_INCLUDE.includes(cal.summary) || cal.primary
      );
      
      console.log(`📅 📋 Found ${calendars.length} total calendars`);
      console.log(`📅 🎯 Fetching events from ${filteredCalendars.length} configured calendars:`, 
        filteredCalendars.map(cal => cal.summary));

      // NEW: Fetch events with controlled concurrency to avoid rate limits
      const calendarResults = [];
      const batchSize = 3; // Process 3 calendars at a time
      
      for (let i = 0; i < filteredCalendars.length; i += batchSize) {
        const batch = filteredCalendars.slice(i, i + batchSize);
        
        console.log(`📅 📦 Processing calendar batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filteredCalendars.length/batchSize)}`);
        
        const batchPromises = batch.map(calendar => 
          this.getCalendarEvents(calendar.id, timeMin, timeMax)
            .then(events => ({
              calendar: calendar,
              events: events,
              status: 'success'
            }))
            .catch(error => {
              console.warn(`📅 ⚠️ Failed to fetch events from calendar ${calendar.summary}:`, error);
              return { 
                calendar: calendar, 
                events: [], 
                status: 'error',
                error: error.message 
              };
            })
        );
        
        const batchResults = await Promise.all(batchPromises);
        calendarResults.push(...batchResults);
        
        // Small delay between batches to be nice to the API
        if (i + batchSize < filteredCalendars.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Combine all events
      const allEvents = [];
      const successfulCalendars = [];
      const failedCalendars = [];
      
      calendarResults.forEach(result => {
        if (result.status === 'success') {
          successfulCalendars.push(result.calendar);
          result.events.forEach(event => {
            allEvents.push({
              ...event,
              calendarName: result.calendar.summary,
              calendarColor: result.calendar.backgroundColor,
              isPrimary: result.calendar.primary || false
            });
          });
        } else {
          failedCalendars.push({
            calendar: result.calendar,
            error: result.error
          });
        }
      });
      
      // Sort events by start time
      allEvents.sort((a, b) => 
        new Date(a.startDateTime) - new Date(b.startDateTime)
      );
      
      const summary = {
        totalEvents: allEvents.length,
        totalCalendars: filteredCalendars.length,
        successfulCalendars: successfulCalendars.length,
        failedCalendars: failedCalendars.length,
        timeRange: { timeMin, timeMax },
        errors: failedCalendars
      };
      
      console.log(`📅 ✅ Calendar fetch complete:`, summary);
      
      return {
        events: allEvents,
        calendars: successfulCalendars,
        summary: summary
      };
      
    } catch (error) {
      console.error('📅 ❌ Failed to fetch calendar data:', error);
      
      // Return empty data structure instead of throwing
      return { 
        events: [], 
        calendars: [], 
        summary: {
          totalEvents: 0,
          totalCalendars: 0,
          successfulCalendars: 0,
          failedCalendars: 0,
          error: error.message
        }
      };
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  // UPDATED: Better testAccess with more detailed results
  async testAccess() {
    console.log('🧪 Testing Google API access...');
    
    const results = {
      photos: false,
      calendar: false,
      errors: [],
      tokenStatus: 'unknown',
      details: {}
    };

    // First, check if we have a token at all
    const token = this.getAccessToken();
    if (!token) {
      results.errors.push('No access token available');
      results.tokenStatus = 'missing';
      console.error('❌ No Google access token available for testing');
      return results;
    }

    console.log(`🧪 Testing with token: ${token.substring(0, 20)}... (length: ${token.length})`);
    results.tokenStatus = 'present';

    // Test Calendar API access
    try {
      console.log('🧪 Testing Calendar API access...');
      const calendarStart = Date.now();
      const calendars = await this.getCalendarList();
      const calendarTime = Date.now() - calendarStart;
      
      if (calendars && calendars.length >= 0) {
        results.calendar = true;
        results.tokenStatus = 'valid';
        results.details.calendar = {
          calendarsFound: calendars.length,
          responseTime: calendarTime,
          configuredCalendars: calendars.filter(cal => 
            CALENDARS_TO_INCLUDE.includes(cal.summary) || cal.primary
          ).length
        };
        console.log('✅ Google Calendar API access confirmed');
        console.log(`✅ Found ${calendars.length} calendars (${results.details.calendar.configuredCalendars} configured)`);
      } else {
        results.calendar = false;
        results.errors.push('Calendar API: No calendars returned');
        console.error('❌ Google Calendar API returned no calendars');
      }
      
    } catch (error) {
      results.calendar = false;
      results.errors.push(`Calendar API: ${error.message}`);
      
      if (error.status === 401) {
        results.tokenStatus = 'expired';
        console.error('❌ Google Calendar API: Token expired or invalid');
      } else {
        results.tokenStatus = 'error';
        console.error('❌ Google Calendar API access failed:', error);
      }
    }
    
    // Test Photos API access (commented out for now as requested)
    /*
    try {
      console.log('🧪 Testing Photos API access...');
      const photosStart = Date.now();
      const albums = await this.getPhotoAlbums();
      const photosTime = Date.now() - photosStart;
      
      results.photos = true;
      results.details.photos = {
        albumsFound: albums.length,
        responseTime: photosTime
      };
      console.log('✅ Google Photos API access confirmed');
      console.log(`✅ Found ${albums.length} photo albums`);
      
    } catch (error) {
      results.photos = false;
      results.errors.push(`Photos API: ${error.message}`);
      console.error('❌ Google Photos API access failed:', error);
    }
    */
    
    // Log final results
    console.log('🧪 ✅ API test complete:', {
      calendar: results.calendar,
      photos: results.photos,
      tokenStatus: results.tokenStatus,
      errorCount: results.errors.length,
      details: results.details
    });
    
    return results;
  }

  // NEW: Health check for monitoring API status
  async healthCheck() {
    const start = Date.now();
    
    try {
      const testResults = await this.testAccess();
      const responseTime = Date.now() - start;
      
      return {
        status: testResults.calendar ? 'healthy' : 'degraded',
        responseTime,
        apis: {
          calendar: testResults.calendar,
          photos: testResults.photos
        },
        tokenStatus: testResults.tokenStatus,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }
}
