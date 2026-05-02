import { createClient } from '@supabase/supabase-js';

// We will use import.meta.env for Vite environment variables
// These values must be provided in a .env.local file in the project root
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Supabase URL or Anon Key is missing. Please ensure you have created a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
}

// Ensure the client is only created once
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder_key'
);

export { supabaseUrl, supabaseAnonKey };
