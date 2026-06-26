// Single place the frontend reads its (client-safe) env. Vite only exposes
// vars prefixed with VITE_ to the browser — anything else stays server-side.
export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
