// lib/app-url.ts

/**
 * Get the current app URL - SMART DETECTION
 * - Uses environment variable FIRST (for consistency)
 * - Falls back to request URL detection
 * - Works for localhost, ngrok, and production
 */
export function getAppUrl(request?: Request): string {
  console.log('🔍 [getAppUrl] === START ===');
  
  // ✅ PRIORITY 1: Use environment variable (CONSISTENT)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    console.log('✅ [getAppUrl] Using NEXT_PUBLIC_APP_URL:', envUrl);
    return envUrl;
  }
  
  // ✅ PRIORITY 2: Try to get URL from request
  if (request) {
    try {
      const url = new URL(request.url);
      const fullUrl = url.origin;
      
      console.log('📋 [getAppUrl] request.url:', request.url);
      console.log('📋 [getAppUrl] url.origin:', fullUrl);
      
      // Check if it's an ngrok URL
      if (url.hostname.includes('ngrok-free.dev') || url.hostname.includes('ngrok.io')) {
        console.log('✅ [getAppUrl] Detected ngrok from request URL:', fullUrl);
        return fullUrl;
      }
      
      // Check if it's localhost
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        console.log('✅ [getAppUrl] Detected localhost from request URL:', fullUrl);
        return fullUrl;
      }
      
      // Any other URL (production, custom domain)
      console.log('✅ [getAppUrl] Using request URL origin:', fullUrl);
      return fullUrl;
    } catch (error) {
      console.warn('⚠️ [getAppUrl] Failed to parse request URL:', error);
    }
  }
  
  // ✅ PRIORITY 3: Check forwarded headers (for proxies)
  if (request) {
    try {
      const headers = request.headers;
      const forwardedHost = headers.get('x-forwarded-host');
      const forwardedProto = headers.get('x-forwarded-proto');
      const host = headers.get('host');
      
      console.log('📋 [getAppUrl] Headers:', { forwardedHost, forwardedProto, host });
      
      if (forwardedHost) {
        const url = `${forwardedProto || 'https'}://${forwardedHost}`;
        console.log('✅ [getAppUrl] Using forwarded headers:', url);
        return url;
      }
    } catch (error) {
      console.warn('⚠️ [getAppUrl] Failed to parse headers:', error);
    }
  }
  
  // ✅ PRIORITY 4: Client-side fallback
  if (typeof window !== 'undefined') {
    const url = window.location.origin;
    console.log('✅ [getAppUrl] Using window.location:', url);
    return url;
  }
  
  // ✅ PRIORITY 5: Final fallback
  console.log('⚠️ [getAppUrl] Using fallback: http://localhost:3000');
  return 'http://localhost:3000';
}

/**
 * Get the app URL for payment callbacks
 */
export function getPaymentReturnUrl(request?: Request): string {
  return getAppUrl(request);
}