// ==================== SUPABASE CLIENT CONFIG ====================
// The Anon Key is safe to expose client-side because Supabase uses Row Level
// Security (RLS) policies at the database level to authorise requests. Even if
// someone extracts this key, they can only access data they are permitted to.
//
// Override these values at runtime by setting window.PAWFEED_CONFIG before this
// script loads. For Vercel, you can inject a tiny <script> tag in index.html or
// serve a /env.js file that sets window.PAWFEED_CONFIG.
// Example:
//   window.PAWFEED_CONFIG = {
//     supabaseUrl: 'https://xxxx.supabase.co',
//     supabaseAnonKey: 'eyJhbGci...'
//   };
// =================================================================

const SUPABASE_URL =
  (window.PAWFEED_CONFIG && window.PAWFEED_CONFIG.supabaseUrl) ||
  'https://uwtyjzhlipidqxibtsqo.supabase.co';

const SUPABASE_ANON_KEY =
  (window.PAWFEED_CONFIG && window.PAWFEED_CONFIG.supabaseAnonKey) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3dHlqemhsaXBpZHF4aWJ0c3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDIyMjAsImV4cCI6MjA5NzcxODIyMH0.QCGZksfnBbk0dYyeT_awlzaVYw4eL_D-Z7vP7wsv4tc';

if (typeof supabase === 'undefined' && typeof window.supabase === 'undefined') {
  console.warn('[PawFeed] Supabase CDN library not yet loaded. Load the CDN script before supabaseClient.js.');
}

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        detectSessionInUrl: true, // Handles OAuth redirect and password-reset deep links
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;

window.supabaseClient = supabaseClient;

// ==================== AUTH STATE CHANGE ====================
// Listen for PASSWORD_RECOVERY events (deep-link redirect after "Reset Password" email)
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      console.log('[PawFeed Auth] PASSWORD_RECOVERY detected — showing update password modal.');
      const modal = document.getElementById('updatePasswordModal');
      if (modal) modal.classList.remove('hidden');
    }
    if (event === 'SIGNED_IN' && session) {
      console.log('[PawFeed Auth] SIGNED_IN via OAuth redirect.');
      // The main app will pick this up if it polls auth state.
    }
  });
}

// ==================== GOOGLE AUTH (Web & Mobile) ====================
async function signInWithGoogle() {
  if (!supabaseClient) throw new Error('[PawFeed] Supabase client not initialised.');

  // Capacitor Native (Mobile App)
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
    // Web Browser OAuth redirect
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

// ==================== AUTH CALLBACK HANDLER ====================
// Processes OAuth redirects and password-reset tokens from URL hash / query params.
async function handleAuthCallback() {
  if (!supabaseClient) return;
  const hash = window.location.hash;
  const search = window.location.search;

  if (hash.includes('access_token=') || search.includes('code=')) {
    // Modern Supabase JS v2 API — getSession() handles the URL token automatically
    // via detectSessionInUrl:true set in the client config above.
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('[PawFeed Auth] Error reading session from URL:', error);
    } else if (data && data.session) {
      console.log('[PawFeed Auth] Session established from URL redirect.');
    }
    // Clean the token from the URL bar without a page reload
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
}

window.signInWithGoogle = signInWithGoogle;
window.handleAuthCallback = handleAuthCallback;

// Call immediately to intercept redirect before the app initialises
handleAuthCallback();