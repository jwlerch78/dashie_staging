// js/google-apis/google-api-client.js - Updated with Cognito Token Manager Integration
// CHANGE SUMMARY: Enhanced to automatically handle Cognito token refresh on 401 errors

// ==================== CONFIG VARIABLES ====================

// How many months ahead to pull events
// How many months ahead to pull events
const MONTHS_AHEAD_TO_PULL = 3;
const MONTHS_BACK_TO_PULL = 1;

// Calendars to include by summary (name/email as shown in calendar list)
const CALENDARS_TO_INCLUDE = [
  "jwlerch@gmail.com",
  "Veeva"
];

// Default album to display photos from
const DEFAULT_PHOTOS_ALBUM = 'Favorites'; // Can be 'Favorites', 'Recent', or specific album title

// Number of photos to fetch
const DEFAULT_PHOTOS_COUNT = 50;

// Album preferences (in order of preference)
const PREFERRED_ALBUMS = [
  'Favorites',
  'Family',
  'Best of',
  'Highlights'
];


// ==================== GOOGLE API CLIENT ====================

export class GoogleAPIClient {
  constructor(authManager) {
    this.authManager = authManager;
    this.baseUrl = 'https://www.googleapis.com';
    
    // Request retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000  // 10 seconds
    };
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
  }

  // UPDATED: Get current access token with automatic Cognito refresh
  async getAccessToken() {
    try {
      // First, try to get the current token
      let token = this.authManager.getGoogleAccessToken();
      
      if (!token) {
        throw new Error('No Google access token available');
      }
      
      return token;
    } catch (error) {
      console.error('📡 ❌ Failed to get valid access token:', error);
      throw new Error('Unable to get valid access token');
    }
  }

  // Rate-limited request wrapper
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

  // ENHANCED: Request method with automatic Cognito token refresh on 401 errors
  async makeRequest(endpoint, options = {}) {
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

    // Retry logic with exponential backoff and Cognito token refresh
    let lastError;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Get fresh token for each attempt (important for retry after refresh)
        const token = await this.getAccessToken();
        
        if (!token) {
          throw new Error('No Google access token available');
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
        
        // Handle 401 Unauthorized - token may be expired
        if (response.status === 401) {
          console.warn(`🔄 Google API 401 error on attempt ${attempt + 1} - token may be expired`);
          
          // Try to refresh token if this is not the last attempt
          if (attempt < this.retryConfig.maxRetries) {
            try {
              console.log('🔄 Attempting to refresh token via Cognito due to 401 error...');
              await this.authManager.refreshGoogleAccessToken();
              console.log('🔄 ✅ Token refreshed via Cognito, retrying API request...');
              
              // Wait a bit before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue; // Retry with refreshed token
              
            } catch (refreshError) {
              console.error('🔄 ❌ Cognito token refresh failed:', refreshError);
              // If refresh fails, don't retry further - let the error bubble up
              throw error;
            }
          } else {
            console.error('❌ Google API 401 error on final attempt - authentication failed');
            throw error;
          }
        }
        
        // Handle 403 Forbidden - insufficient permissions or quota
        if (response.status === 403) {
          console.error(`❌ Google API 403 error (forbidden):`, errorText);
          throw error; // Don't retry on 403
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
        
        // If it's a network error, retry if we have attempts left
        if (!error.status && attempt < this.retryConfig.maxRetries) {
          console.warn(`⚠️ Network error on attempt ${attempt + 1}, will retry:`, error.message);
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's not a retryable error or we're out of attempts
        throw error;
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('All API request attempts failed');
  }

  // EXISTING CALENDAR API METHODS (updated to use enhanced makeRequest)

  // Get list of calendars
  async getCalendarList() {
    console.log('📅 Fetching calendar list...');
    
    try {
      const data = await this.makeRequest('/calendar/v3/users/me/calendarList');
      
      const calendars = data.items || [];
      console.log(`📅 Found ${calendars.length} calendars`);
      
      return calendars.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description || '',
        primary: cal.primary || false,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor
      }));
      
    } catch (error) {
      console.error('📅 ❌ Failed to fetch calendar list:', error);
      throw new Error(`Calendar list fetch failed: ${error.message}`);
    }
  }

  // Get events from a specific calendar
  async getCalendarEvents(calendarId, timeMin = null, timeMax = null) {
    console.log(`📅 Fetching events from calendar: ${calendarId}`);
    
    const now = new Date();
    const defaultTimeMin = timeMin || new Date(now.getTime() - (MONTHS_BACK_TO_PULL * 30 * 24 * 60 * 60 * 1000)).toISOString();
    const defaultTimeMax = timeMax || new Date(now.getTime() + (MONTHS_AHEAD_TO_PULL * 30 * 24 * 60 * 60 * 1000)).toISOString();

    
    const params = new URLSearchParams({
      timeMin: defaultTimeMin,
      timeMax: defaultTimeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100'
    });
    
    try {
      const data = await this.makeRequest(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
      
      const events = data.items || [];
      console.log(`📅 Found ${events.length} events in calendar ${calendarId}`);
      
      return events.map(event => ({
        id: event.id,
        summary: event.summary || 'No title',
        description: event.description || '',
        start: event.start,
        end: event.end,
        location: event.location || '',
        attendees: event.attendees || [],
        calendarId: calendarId
      }));
      
    } catch (error) {
      console.error(`📅 ❌ Failed to fetch events from calendar ${calendarId}:`, error);
      throw new Error(`Calendar events fetch failed: ${error.message}`);
    }
  }

  // Get events from all configured calendars
  async getAllCalendarEvents() {
    console.log('📅 🔄 Fetching events from all configured calendars...');
    
    try {
      // Get calendar list first
      const calendars = await this.getCalendarList();
      
      // Filter to configured calendars
      const targetCalendars = calendars.filter(cal => 
        CALENDARS_TO_INCLUDE.some(target => 
          cal.summary.includes(target) || cal.id.includes(target)
        )
      );
      
      console.log(`📅 Fetching from ${targetCalendars.length} configured calendars:`, 
        targetCalendars.map(cal => cal.summary));
      
      // Fetch events from each calendar
      const allEvents = [];
      for (const calendar of targetCalendars) {
        try {
          const events = await this.getCalendarEvents(calendar.id);
          allEvents.push(...events);
        } catch (error) {
          console.error(`📅 ⚠️ Failed to fetch from calendar ${calendar.summary}:`, error);
          // Continue with other calendars
        }
      }
      
      // Sort all events by start time
      allEvents.sort((a, b) => {
        const aStart = new Date(a.start.dateTime || a.start.date);
        const bStart = new Date(b.start.dateTime || b.start.date);
        return aStart - bStart;
      });
      
      console.log(`📅 ✅ Total events fetched: ${allEvents.length}`);
      return allEvents;
      
    } catch (error) {
      console.error('📅 ❌ Failed to fetch all calendar events:', error);
      throw new Error(`All calendar events fetch failed: ${error.message}`);
    }
  }

// Google Photos API Methods - Enhanced Implementation
// CHANGE SUMMARY: Added complete Google Photos API integration with Favorites album support and album listing


// ==================== GOOGLE PHOTOS API METHODS ====================

// Get all photo albums with detailed logging
async getPhotoAlbums() {
  console.log('📸 Fetching photo albums...');
  
  try {
    const data = await this.makeRequest('/v1/albums');
    
    const albums = data.albums || [];
    console.log(`📸 ✅ Found ${albums.length} total albums`);
    
    // Log all albums to console as requested
    console.log('📸 📋 Complete Album List:');
    albums.forEach((album, index) => {
      console.log(`📸 ${index + 1}. "${album.title}" (${album.mediaItemsCount || 0} items)`);
      console.log(`   📸 ID: ${album.id}`);
      console.log(`   📸 URL: ${album.productUrl || 'N/A'}`);
      console.log(`   📸 Cover: ${album.coverPhotoBaseUrl || 'N/A'}`);
    });
    
    return albums.map(album => ({
      id: album.id,
      title: album.title,
      productUrl: album.productUrl,
      mediaItemsCount: album.mediaItemsCount || 0,
      coverPhotoBaseUrl: album.coverPhotoBaseUrl,
      coverPhotoMediaItemId: album.coverPhotoMediaItemId,
      isWriteable: album.isWriteable || false
    }));
    
  } catch (error) {
    console.error('📸 ❌ Failed to fetch photo albums:', error);
    throw new Error(`Photo albums fetch failed: ${error.message}`);
  }
}

// Get photos from a specific album
async getAlbumPhotos(albumId, pageSize = DEFAULT_PHOTOS_COUNT) {
  console.log(`📸 Fetching photos from album: ${albumId}`);
  
  try {
    const requestBody = {
      albumId: albumId,
      pageSize: pageSize
    };
    
    const data = await this.makeRequest('/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const photos = data.mediaItems || [];
    console.log(`📸 ✅ Found ${photos.length} photos in album`);
    
    return photos.map(photo => ({
      id: photo.id,
      description: photo.description || '',
      productUrl: photo.productUrl,
      baseUrl: photo.baseUrl,
      mimeType: photo.mimeType,
      filename: photo.filename,
      mediaMetadata: {
        creationTime: photo.mediaMetadata?.creationTime,
        width: photo.mediaMetadata?.width,
        height: photo.mediaMetadata?.height
      }
    }));
    
  } catch (error) {
    console.error(`📸 ❌ Failed to fetch album photos for ${albumId}:`, error);
    throw new Error(`Album photos fetch failed: ${error.message}`);
  }
}

// Get photos from configured default album
async getDefaultAlbumPhotos(pageSize = DEFAULT_PHOTOS_COUNT) {
  console.log(`📸 🎯 Looking for configured album: "${DEFAULT_PHOTOS_ALBUM}"`);
  
  try {
    // Handle special case for 'Recent' - bypass album search
    if (DEFAULT_PHOTOS_ALBUM.toLowerCase() === 'recent') {
      console.log('📸 📅 Using recent photos as configured');
      return await this.getRecentPhotos(pageSize);
    }
    
    // Handle special case for 'Favorites' - use starred photos API
    if (DEFAULT_PHOTOS_ALBUM.toLowerCase() === 'favorites') {
      console.log('📸 🌟 Using starred photos (Favorites) as configured');
      return await this.getStarredPhotos(pageSize);
    }
    
    // First get all albums to find the configured one
    const albums = await this.getPhotoAlbums();
    
    // Look for exact match first, then partial match
    let targetAlbum = albums.find(album => 
      album.title.toLowerCase() === DEFAULT_PHOTOS_ALBUM.toLowerCase()
    );
    
    if (!targetAlbum) {
      targetAlbum = albums.find(album => 
        album.title.toLowerCase().includes(DEFAULT_PHOTOS_ALBUM.toLowerCase())
      );
    }
    
    if (!targetAlbum) {
      console.log(`📸 ⚠️ Album "${DEFAULT_PHOTOS_ALBUM}" not found, trying preferred albums...`);
      
      // Try preferred albums in order
      for (const preferredAlbum of PREFERRED_ALBUMS) {
        if (preferredAlbum.toLowerCase() === 'favorites') {
          try {
            console.log('📸 🌟 Trying starred photos...');
            return await this.getStarredPhotos(pageSize);
          } catch (e) {
            console.log('📸 ⚠️ Starred photos failed, continuing...');
            continue;
          }
        }
        
        targetAlbum = albums.find(album => 
          album.title.toLowerCase().includes(preferredAlbum.toLowerCase())
        );
        
        if (targetAlbum) {
          console.log(`📸 ✅ Found preferred album: "${targetAlbum.title}"`);
          break;
        }
      }
    }
    
    if (!targetAlbum) {
      console.log('📸 ⚠️ No preferred albums found, falling back to recent photos');
      return await this.getRecentPhotos(pageSize);
    }
    
    console.log(`📸 🎯 Using album: "${targetAlbum.title}" with ${targetAlbum.mediaItemsCount} items`);
    
    // Get photos from the target album
    const photos = await this.getAlbumPhotos(targetAlbum.id, pageSize);
    
    console.log(`📸 ✅ Retrieved ${photos.length} photos from "${targetAlbum.title}"`);
    return photos;
    
  } catch (error) {
    console.error('📸 ❌ Failed to fetch configured album photos:', error);
    // Fallback to recent photos if everything fails
    console.log('📸 🔄 Falling back to recent photos...');
    return await this.getRecentPhotos(pageSize);
  }
}

// Get starred photos (true Favorites in Google Photos)
async getStarredPhotos(pageSize = DEFAULT_PHOTOS_COUNT) {
  console.log(`📸 ⭐ Fetching ${pageSize} starred photos (Favorites)...`);
  
  try {
    const requestBody = {
      pageSize: pageSize,
      filters: {
        mediaTypeFilter: {
          mediaTypes: ['PHOTO'] // Only photos, not videos
        },
        featureFilter: {
          includedFeatures: ['FAVORITES'] // This gets starred/favorited photos
        }
      }
    };
    
    const data = await this.makeRequest('/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const photos = data.mediaItems || [];
    console.log(`📸 ⭐ Found ${photos.length} starred photos`);
    
    return photos.map(photo => ({
      id: photo.id,
      description: photo.description || '',
      productUrl: photo.productUrl,
      baseUrl: photo.baseUrl,
      mimeType: photo.mimeType,
      filename: photo.filename,
      mediaMetadata: {
        creationTime: photo.mediaMetadata?.creationTime,
        width: photo.mediaMetadata?.width,
        height: photo.mediaMetadata?.height
      }
    }));
    
  } catch (error) {
    console.error('📸 ❌ Failed to fetch starred photos:', error);
    throw new Error(`Starred photos fetch failed: ${error.message}`);
  }
}

// Get recent photos (fallback or general use)
async getRecentPhotos(pageSize = DEFAULT_PHOTOS_COUNT) {
  console.log(`📸 Fetching ${pageSize} recent photos...`);
  
  try {
    const requestBody = {
      pageSize: pageSize,
      filters: {
        mediaTypeFilter: {
          mediaTypes: ['PHOTO'] // Only photos, not videos
        }
      }
    };
    
    const data = await this.makeRequest('/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const photos = data.mediaItems || [];
    console.log(`📸 ✅ Found ${photos.length} recent photos`);
    
    return photos.map(photo => ({
      id: photo.id,
      description: photo.description || '',
      productUrl: photo.productUrl,
      baseUrl: photo.baseUrl,
      mimeType: photo.mimeType,
      filename: photo.filename,
      mediaMetadata: {
        creationTime: photo.mediaMetadata?.creationTime,
        width: photo.mediaMetadata?.width,
        height: photo.mediaMetadata?.height
      }
    }));
    
  } catch (error) {
    console.error('📸 ❌ Failed to fetch recent photos:', error);
    throw new Error(`Recent photos fetch failed: ${error.message}`);
  }
}

// Helper method to get displayable photo URL with size parameters
getDisplayPhotoUrl(baseUrl, width = 800, height = 600) {
  if (!baseUrl) return null;
  
  // Google Photos allows appending size parameters to baseUrl
  // Format: baseUrl=w{width}-h{height} for specific dimensions
  // Format: baseUrl=s{size} for square images
  return `${baseUrl}=w${width}-h${height}`;
}

  
  // Health check for monitoring API status
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


// Debug method to check token scopes and permissions
async debugPhotosAPIAccess() {
  console.log('🔍 📸 Starting Photos API debug analysis...');
  
  try {
    // Get current token
    const token = await this.getAccessToken();
    if (!token) {
      console.error('🔍 ❌ No access token available');
      return { success: false, error: 'No access token' };
    }
    
    console.log('🔍 ✅ Access token found:', token.substring(0, 20) + '...');
    
    // Check token info from Google
    try {
      console.log('🔍 📡 Checking token info with Google...');
      const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      
      if (tokenInfoResponse.ok) {
        const tokenInfo = await tokenInfoResponse.json();
        console.log('🔍 ✅ Token info:', {
          scope: tokenInfo.scope,
          audience: tokenInfo.audience,
          expires_in: tokenInfo.expires_in,
          issued_to: tokenInfo.issued_to
        });
        
        // Check if Photos scope is present
        const hasPhotosScope = tokenInfo.scope && tokenInfo.scope.includes('photoslibrary.readonly');
        console.log('🔍 📸 Photos scope present:', hasPhotosScope);
        
        if (!hasPhotosScope) {
          console.error('🔍 ❌ Photos scope missing from token!');
          console.log('🔍 Available scopes:', tokenInfo.scope);
          return { 
            success: false, 
            error: 'Photos scope missing',
            tokenInfo: tokenInfo
          };
        }
      } else {
        console.error('🔍 ❌ Token info request failed:', tokenInfoResponse.status);
      }
    } catch (tokenInfoError) {
      console.error('🔍 ❌ Failed to get token info:', tokenInfoError);
    }
    
    // Try a simple Photos API call
    console.log('🔍 📸 Testing basic Photos API access...');
    try {
      const testResponse = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=1', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔍 📸 Photos API test response status:', testResponse.status);
      
      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log('🔍 ✅ Photos API test successful!', testData);
        return { success: true, message: 'Photos API accessible' };
      } else {
        const errorText = await testResponse.text();
        console.error('🔍 ❌ Photos API test failed:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('🔍 📸 Parsed error:', errorData);
          return { 
            success: false, 
            error: errorData.error?.message || 'Unknown Photos API error',
            status: testResponse.status,
            errorData: errorData
          };
        } catch (parseError) {
          return { 
            success: false, 
            error: errorText,
            status: testResponse.status
          };
        }
      }
    } catch (apiError) {
      console.error('🔍 ❌ Photos API test request failed:', apiError);
      return { success: false, error: apiError.message };
    }
    
  } catch (debugError) {
    console.error('🔍 ❌ Debug analysis failed:', debugError);
    return { success: false, error: debugError.message };
  }
}

// Enhanced testAccess method with Photos API debugging
async testAccess() {
  console.log('🧪 Testing Google API access...');
  
  const results = {
    calendar: false,
    photos: false,
    tokenStatus: 'unknown',
    errors: [],
    details: {},
    debug: {}
  };
  
  // Test Calendar API access (existing)
  try {
    console.log('🧪 Testing Calendar API access...');
    const calendarStart = Date.now();
    const calendars = await this.getCalendarList();
    const calendarTime = Date.now() - calendarStart;
    
    results.calendar = true;
    results.tokenStatus = 'valid';
    results.details.calendar = {
      calendarsFound: calendars.length,
      responseTime: calendarTime,
      configuredCalendars: calendars.filter(cal => 
        CALENDARS_TO_INCLUDE.some(target => 
          cal.summary.includes(target) || cal.id.includes(target)
        )
      ).length
    };
    console.log('✅ Google Calendar API access confirmed');
    console.log(`✅ Found ${calendars.length} calendars (${results.details.calendar.configuredCalendars} configured)`);
    
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
  
  // Test Photos API access with enhanced debugging
  console.log('🧪 Testing Google Photos API access...');
  const debugResult = await this.debugPhotosAPIAccess();
  results.debug.photos = debugResult;
  
  if (debugResult.success) {
    try {
      const photosStart = Date.now();
      const albums = await this.getPhotoAlbums();
      const photosTime = Date.now() - photosStart;
      
      results.photos = true;
      if (results.tokenStatus === 'unknown') {
        results.tokenStatus = 'valid';
      }
      results.details.photos = {
        albumsFound: albums.length,
        responseTime: photosTime,
        configuredAlbum: DEFAULT_PHOTOS_ALBUM,
        favoritesAlbum: albums.find(album => 
          album.title.toLowerCase().includes('favorite') || 
          album.title.toLowerCase().includes('favourites')
        ) ? 'found' : 'not found'
      };
      console.log('✅ Google Photos API access confirmed');
      console.log(`✅ Found ${albums.length} albums (Configured: ${DEFAULT_PHOTOS_ALBUM}, Favorites: ${results.details.photos.favoritesAlbum})`);
      
    } catch (error) {
      results.photos = false;
      results.errors.push(`Photos API: ${error.message}`);
      console.error('❌ Google Photos API access failed:', error);
    }
  } else {
    results.photos = false;
    results.errors.push(`Photos API Debug: ${debugResult.error}`);
    console.error('❌ Google Photos API debug failed:', debugResult.error);
  }
  
  // Log final results
  console.log('🧪 ✅ API test complete:', {
    calendar: results.calendar,
    photos: results.photos,
    tokenStatus: results.tokenStatus,
    errorCount: results.errors.length,
    details: results.details,
    debug: results.debug
  });
  
  return results;
}
