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

// ==================== GOOGLE AUTH ====================
async function signInWithGoogle() {
  if (!supabaseClient) throw new Error("Supabase client not initialized.");

  // Capacitor Native
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      if (window.Capacitor.Plugins.GoogleAuth) {
         await window.Capacitor.Plugins.GoogleAuth.initialize();
      }
      const googleUser = await window.Capacitor.Plugins.GoogleAuth.signIn();
      if (!googleUser.authentication.idToken) {
        throw new Error("No ID token returned from Google.");
      }
      const { data, error } = await supabaseClient.auth.signInWithIdToken({
        provider: 'google',
        token: googleUser.authentication.idToken
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Google native sign-in error:", err);
      alert("Native Auth Error: " + (err.message || JSON.stringify(err)));
      throw err;
    }
  } else {
    // Web Browser
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
    return data;
  }
}

async function handleAuthCallback() {
  if (!supabaseClient) return;
  const hash = window.location.hash;
  const search = window.location.search;
  
  if (hash.includes('access_token=') || search.includes('code=')) {
    const { data, error } = await supabaseClient.auth.getSessionFromUrl({ storeSession: true });
    if (error) {
      console.error("Error parsing auth callback:", error);
    }
  }
}

window.signInWithGoogle = signInWithGoogle;
window.handleAuthCallback = handleAuthCallback;

// Call it immediately so it intercepts the redirect before the app fully initializes
handleAuthCallback();