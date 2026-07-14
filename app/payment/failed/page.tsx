// app/payment/failed/page.tsx
'use client';

import Link from 'next/link';
import { XCircleIcon } from '@heroicons/react/24/outline';

export default function PaymentFailedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <XCircleIcon className="h-20 w-20 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Payment Failed
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Your payment could not be processed. Please try again.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => window.history.back()}
            className="block w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-md transition-all"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="block w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}