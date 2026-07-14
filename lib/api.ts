// lib/api.ts

/**
 * Get the API base URL dynamically
 * - Uses environment variable FIRST (for consistency)
 * - Falls back to window.location.origin (for client-side)
 * - Works for localhost, ngrok, and production
 */
export function getApiBaseUrl(): string {
  console.log('🔍 [getApiBaseUrl] === START ===');
  
  // ✅ PRIORITY 1: Use environment variable (CONSISTENT)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    console.log('✅ [getApiBaseUrl] Using NEXT_PUBLIC_APP_URL:', envUrl);
    return envUrl;
  }
  
  // ✅ PRIORITY 2: Client-side auto-detection
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    console.log('✅ [getApiBaseUrl] Using window.location.origin:', origin);
    return origin;
  }
  
  // ✅ PRIORITY 3: Fallback
  console.log('⚠️ [getApiBaseUrl] Using fallback: http://localhost:3000');
  return 'http://localhost:3000';
}

/**
 * API Response type
 */
export interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  message?: string;
  data?: T;
  requiresApproval?: boolean;
  emailSent?: boolean;
  role?: string;
  user?: any;
  requiresVerification?: boolean;
}

/**
 * Make API calls with dynamic base URL
 */
export async function apiFetch(endpoint: string, options?: RequestInit) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  console.log('🌐 [apiFetch] Request URL:', url);
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

/**
 * Helper to handle API responses
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  return response.json();
}

/**
 * API client with methods - TYPED VERSION
 */
export const api = {
  get: async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
    const response = await apiFetch(endpoint, { ...options, method: 'GET' });
    return handleApiResponse<T>(response);
  },
  
  post: async <T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> => {
    const response = await apiFetch(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleApiResponse<T>(response);
  },
  
  put: async <T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> => {
    const response = await apiFetch(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleApiResponse<T>(response);
  },
  
  delete: async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
    const response = await apiFetch(endpoint, { ...options, method: 'DELETE' });
    return handleApiResponse<T>(response);
  },
};