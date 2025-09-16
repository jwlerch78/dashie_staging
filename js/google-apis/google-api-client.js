// js/google-apis/google-api-client.js - Centralized Google API client
// FIXED: testAccess method to properly handle 401 errors and not report false positives

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
  }

  // Get current access token from auth manager
  getAccessToken() {
    return this.authManager.getGoogleAccessToken();
  }

  // Generic API request method with error handling
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

    console.log(`📡 Making Google API request to: ${url}`);
    
    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google API Error (${response.status}):`, errorText);
        throw new Error(`Google API request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Google API request successful`);
      return data;
      
    } catch (error) {
      console.error('Google API request failed:', error);
      throw error;
    }
  }

  // ====================
  // GOOGLE PHOTOS METHODS
  // ====================

  async getPhotoAlbums() {
    console.log('📸 Fetching Google Photos albums...');
    
    try {
      const response = await this.makeRequest('/v1/albums', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`
        }
      });
      
      const albums = response.albums || [];
      console.log(`📸 Found ${albums.length} photo albums`);
      
      return albums.map(album => ({
        id: album.id,
        title: album.title,
        productUrl: album.productUrl,
        mediaItemsCount: album.mediaItemsCount,
        coverPhotoBaseUrl: album.coverPhotoBaseUrl,
        isWriteable: album.isWriteable
      }));
      
    } catch (error) {
      console.error('Failed to fetch photo albums:', error);
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
      console.log(`📸 Found ${mediaItems.length} photos in album`);
      
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
      console.error(`Failed to fetch photos from album ${albumId}:`, error);
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
      console.log(`📸 Found ${mediaItems.length} recent photos`);
      
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
      console.error('Failed to fetch recent photos:', error);
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
      console.log(`📅 Found ${calendars.length} calendars`);
      
      return calendars.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        primary: cal.primary,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
        accessRole: cal.accessRole,
        selected: cal.selected,
        timeZone: cal.timeZone
      }));
      
    } catch (error) {
      console.error('Failed to fetch calendar list:', error);
      throw error; // Re-throw so testAccess can catch it properly
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
      console.log(`📅 Found ${events.length} events in calendar`);
      
      return events.map(event => ({
        id: event.id,
        summary: event.summary,
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
      console.error(`Failed to fetch events from calendar ${calendarId}:`, error);
      return [];
    }
  }

  async getAllCalendarEvents(timeMin = null, timeMax = null) {
    console.log('📅 Fetching events from all calendars...');
    
    try {
      const calendars = await this.getCalendarList();
      
      // Filter calendars by our config list
      const filteredCalendars = calendars.filter(cal =>
        CALENDARS_TO_INCLUDE.includes(cal.summary)
      );
      
      console.log(`📅 Fetching events from ${filteredCalendars.length} configured calendars`);

      // Fetch events from each
      const allEventPromises = filteredCalendars.map(calendar => 
        this.getCalendarEvents(calendar.id, timeMin, timeMax)
          .then(events => ({
            calendar: calendar,
            events: events
          }))
          .catch(error => {
            console.warn(`Failed to fetch events from calendar ${calendar.summary}:`, error);
            return { calendar: calendar, events: [] };
          })
      );
      
      const calendarResults = await Promise.all(allEventPromises);
      
      const allEvents = [];
      calendarResults.forEach(result => {
        result.events.forEach(event => {
          allEvents.push({
            ...event,
            calendarName: result.calendar.summary,
            calendarColor: result.calendar.backgroundColor,
            isPrimary: result.calendar.primary
          });
        });
      });
      
      allEvents.sort((a, b) => 
        new Date(a.startDateTime) - new Date(b.startDateTime)
      );
      
      console.log(`📅 Total events found: ${allEvents.length}`);
      
      return {
        events: allEvents,
        calendars: filteredCalendars,
        summary: {
          totalEvents: allEvents.length,
          totalCalendars: filteredCalendars.length,
          timeRange: { timeMin, timeMax }
        }
      };
      
    } catch (error) {
      console.error('Failed to fetch all calendar events:', error);
      return { events: [], calendars: [], summary: null };
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  // FIXED: Proper error handling in testAccess method
  async testAccess() {
    console.log('🧪 Testing Google API access...');
    
    const results = {
      photos: false,
      calendar: false,
      errors: [],
      tokenStatus: 'unknown'
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

/******************************************************************
* Commenting out photos retrieval for now
    try {
      await this.getPhotoAlbums();
      results.photos = true;
      console.log('✅ Google Photos API access confirmed');
    } catch (error) {
      results.errors.push(`Photos API: ${error.message}`);
      console.error('❌ Google Photos API access failed:', error);
    }

******************************************************************/    
    
    // FIXED: Properly test calendar access with explicit error handling
    try {
      console.log('🧪 Testing Calendar API access...');
      const calendars = await this.getCalendarList();
      
      // Only mark as successful if we actually got calendars back
      if (calendars && calendars.length >= 0) {
        results.calendar = true;
        results.tokenStatus = 'valid';
        console.log('✅ Google Calendar API access confirmed');
        console.log(`✅ Found ${calendars.length} calendars`);
      } else {
        results.calendar = false;
        results.errors.push('Calendar API: No calendars returned');
        console.error('❌ Google Calendar API returned no calendars');
      }
      
    } catch (error) {
      results.calendar = false;
      results.errors.push(`Calendar API: ${error.message}`);
      
      // Check if it's specifically a 401 error (expired/invalid token)
      if (error.message.includes('401')) {
        results.tokenStatus = 'expired';
        console.error('❌ Google Calendar API access failed: Token appears to be expired or invalid');
        console.error('❌ This is likely because the saved access token has expired (they expire after ~1 hour)');
        console.error('❌ A proper refresh token mechanism is needed to automatically get new access tokens');
      } else {
        results.tokenStatus = 'error';
        console.error('❌ Google Calendar API access failed with non-auth error:', error);
      }
    }
    
    // Log final results for debugging
    console.log('🧪 Final API test results:', {
      calendar: results.calendar,
      photos: results.photos,
      tokenStatus: results.tokenStatus,
      errorCount: results.errors.length,
      errors: results.errors
    });
    
    return results;
  }
}
