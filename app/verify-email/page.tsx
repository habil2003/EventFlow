"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [role, setRole] = useState('');

  useEffect(() => {
    console.log('🔍 Token from URL:', token ? token.substring(0, 20) + '...' : 'No token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        console.log('📤 Sending verification request...');
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        console.log('📡 API Response:', data);

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
          setRequiresApproval(data.requiresApproval || false);
          setRole(data.role || '');
          
          // ✅ Redirect after 5 seconds
          setTimeout(() => {
            if (data.requiresApproval) {
              router.push('/login?verified=true&pending=true');
            } else {
              router.push('/login?verified=true');
            }
          }, 5000);
        } else {
          if (data.expired) {
            setStatus('expired');
            setMessage(data.error || 'Verification link has expired');
          } else if (data.alreadyVerified) {
            setStatus('success');
            setMessage(data.message || 'Email already verified!');
            setTimeout(() => router.push('/login'), 3000);
          } else {
            setStatus('error');
            setMessage(data.error || 'Verification failed');
          }
        }
      } catch (error) {
        console.error('❌ Verification error:', error);
        setStatus('error');
        setMessage('An error occurred. Please try again.');
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mb-4"></div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Verifying your email...</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Please wait while we verify your account.</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Email Verified! ✅</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{message}</p>
            
            {requiresApproval && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <ClockIcon className="h-5 w-5" />
                  Your account requires admin approval. You will receive an email once approved.
                </p>
              </div>
            )}

            <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to login...</p>
            
            <div className="mt-4">
              <Link
                href="/login"
                className="inline-block px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-md transition-all"
              >
                Go to Login Now
              </Link>
            </div>
          </>
        )}
        
        {status === 'expired' && (
          <>
            <ClockIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Link Expired</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{message}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Don't worry! You can request a new verification link below.
            </p>
            
            {/* ✅ Resend button with email input */}
            <div className="mb-4">
              <input
                type="email"
                id="resend-email"
                placeholder="Enter your email"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={async () => {
                const emailInput = document.getElementById('resend-email') as HTMLInputElement;
                const email = emailInput?.value;
                if (!email) {
                  alert('Please enter your email address.');
                  return;
                }
                
                try {
                  const response = await fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                  });
                  const data = await response.json();
                  if (response.ok) {
                    alert('Verification email sent! Please check your inbox.');
                  } else {
                    alert(data.error || 'Failed to resend verification email.');
                  }
                } catch (err) {
                  alert('An error occurred. Please try again.');
                }
              }}
              className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Resend Verification Email
            </button>
            
            <div className="mt-4">
              <Link
                href="/login"
                className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Back to Login
              </Link>
            </div>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verification Failed</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-md transition-all"
            >
              Go to Login
            </Link>
            <div className="mt-4">
              <button
                onClick={() => {
                  const email = prompt('Enter your email to resend verification:');
                  if (email) {
                    fetch('/api/auth/resend-verification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email }),
                    })
                    .then(res => res.json())
                    .then(data => {
                      if (data.success) {
                        alert('Verification email sent!');
                      } else {
                        alert(data.error || 'Failed to send.');
                      }
                    })
                    .catch(() => alert('An error occurred.'));
                  }
                }}
                className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Resend Verification Email
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-pulse">
            <div className="h-12 w-12 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full mb-4"></div>
            <div className="h-6 w-3/4 mx-auto bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-1/2 mx-auto bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}