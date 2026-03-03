import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseClient);
}

export function requireSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      'Supabase config missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  return supabaseClient;
}
