// js/supabase/supabase-config.js - Supabase Configuration

import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Get database config based on environment (prod vs dev)
const supabaseUrl = window.currentDbConfig.supabaseUrl;
const supabaseAnonKey = window.currentDbConfig.supabaseKey;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Don't persist session in localStorage since we handle auth ourselves
    persistSession: false,
    // Don't auto-refresh tokens
    autoRefreshToken: false,
    // Don't detect session from URL
    detectSessionInUrl: false
  }
});

console.log('📊 Supabase client initialized:', supabaseUrl);
