// ==================== SUPABASE CLIENT CONFIG ====================
// The Anon Key is safe to expose client-side because Supabase uses Row Level
// Security (RLS) policies at the database level to authorize requests. Even if
// someone extracts this key, they can only access data they are permitted to see.
// =================================================================

const SUPABASE_URL = 'https://uwtyjzhlipidqxibtsqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3dHlqemhsaXBpZHF4aWJ0c3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDIyMjAsImV4cCI6MjA5NzcxODIyMH0.QCGZksfnBbk0dYyeT_awlzaVYw4eL_D-Z7vP7wsv4tc';

if (typeof supabase === 'undefined' && typeof window.supabase === 'undefined') {
  console.warn("Supabase CDN library was not loaded yet. Make sure to load the CDN script first.");
}

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
window.supabaseClient = supabaseClient;
