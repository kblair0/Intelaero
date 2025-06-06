/**
 * Payment Success Page
 * 
 * Purpose: Handles post-payment flow by displaying and managing access codes
 * after a successful Stripe payment transaction.
 * 
 * Related components/files:
 * - API route: /api/stripe/session - Retrieves session details including access codes
 * - May connect to: Authentication system, Product activation system
 * - Used by: Stripe checkout redirect flow
 * 
 * Features:
 * - Validates payment session
 * - Retrieves and displays access code with clipboard functionality
 * - Handles polling for delayed webhook processing
 * - Provides error handling and recovery options
 */

"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Copy, ChevronRight, Loader } from 'lucide-react';
import Link from 'next/link';

// Constants to improve maintainability
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;
const COPY_NOTIFICATION_DELAY_MS = 2000;

// Interfaces for better type safety
interface SessionData {
  accessCode: string;
  productName: string;
}

/**
 * Loading fallback component for Suspense boundary
 */
function PaymentSuccessLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Check className="w-6 h-6" />
              Payment Successful
            </h1>
            <p className="text-sm text-green-100">
              Loading your access code...
            </p>
          </div>
          <div className="px-6 py-8">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="mt-4 text-gray-600">
                Preparing your payment details...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main payment success content component
 * Separated to handle useSearchParams within Suspense boundary
 */
function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Core state
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Polling state
  const [retries, setRetries] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  
  // Extract URL parameters
  const sessionId = searchParams.get('session_id');
  const productId = searchParams.get('product_id'); // Available for future use
  
  /**
   * Fetches session details from the API
   * Implements exponential backoff for robustness
   */
  const fetchSessionDetails = useCallback(async () => {
    if (!sessionId) {
      setError('Invalid session ID');
      setLoading(false);
      return;
    }
    
    try {
      setIsWaiting(true);
      const response = await fetch(`/api/stripe/session?id=${sessionId}`);
      
      if (!response.ok) {
        // Handle HTTP errors properly
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
      }
      
      const data = await response.json();
      
      if (data.accessCode) {
        // Success case - we have the access code
        setSessionData({
          accessCode: data.accessCode,
          productName: data.productName || 'Premium Access'
        });
        setLoading(false);
        setIsWaiting(false);
      } else {
        // Retry logic with backoff
        if (retries < MAX_RETRIES) {
          console.log(`No access code found yet. Retry ${retries + 1}/${MAX_RETRIES} in ${RETRY_DELAY_MS/1000} seconds...`);
          
          // Wait before trying again
          setTimeout(() => {
            setRetries(prev => prev + 1);
          }, RETRY_DELAY_MS);
        } else {
          // After max retries, show appropriate error
          setError('Access code not found. The webhook might still be processing. Please refresh the page in a few moments or contact support.');
          setLoading(false);
          setIsWaiting(false);
        }
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
      setError(error instanceof Error ? error.message : 'Failed to retrieve your access code. Please contact support.');
      setLoading(false);
      setIsWaiting(false);
    }
  }, [sessionId, retries]);
  
  // Fetch session details when component mounts or retries changes
  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);
  
  /**
   * Copies access code to clipboard and shows temporary confirmation
   */
  const copyToClipboard = useCallback(() => {
    if (sessionData?.accessCode) {
      navigator.clipboard.writeText(sessionData.accessCode)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), COPY_NOTIFICATION_DELAY_MS);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          // Could show an error toast here
        });
    }
  }, [sessionData]);
  
  /**
   * Renders loading state with appropriate messaging based on current status
   */
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      <p className="mt-4 text-gray-600">
        {isWaiting ? 
          `Waiting for access code to be ready... (${retries}/${MAX_RETRIES})` : 
          'Retrieving your access code...'}
      </p>
    </div>
  );
  
  /**
   * Renders error state with recovery options
   */
  const renderError = () => (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-500 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-medium text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-6">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mr-2"
      >
        Try Again
      </button>
      <button
        onClick={() => router.push('/')}
        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
      >
        Return to Home
      </button>
    </div>
  );
  
  /**
   * Renders success state with access code and instructions
   */
  const renderSuccess = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-500 mb-4">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-medium text-gray-900 mb-2">
          {sessionData?.productName} Activated
        </h2>
        <p className="text-gray-600">
          Your access code is ready. Copy it and use it to activate premium features.
        </p>
      </div>
      
      {/* Access code display */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Access Code
        </label>
        <div className="flex">
          <div className="bg-gray-100 border border-gray-300 rounded-l-md px-4 py-3 flex-grow font-mono text-lg tracking-wide text-gray-900">
            {sessionData?.accessCode}
          </div>
          <button
            onClick={copyToClipboard}
            className={`px-4 py-2 rounded-r-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            aria-label={copied ? "Copied" : "Copy to clipboard"}
          >
            {copied ? (
              <Check className="w-5 h-5" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Keep this code safe. You&apos;ll need it to activate your premium features.
        </p>
      </div>
      
      {/* Instructions */}
      <div className="rounded-md bg-blue-50 p-4 border border-blue-200">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          How to activate your premium features:
        </h3>
        <ol className="space-y-1 text-sm text-blue-700 ml-4 list-decimal">
          <li>Go to any premium feature in the application</li>
          <li>Click the feature to open the &quot;upgrade modal&quot;</li>
          <li>Select the &quot;Enter Access Code&quot; tab</li>
          <li>Enter your code and click &quot;Activate&quot;</li>
        </ol>
      </div>
      
      {/* Action buttons */}
      <div className="flex flex-col space-y-2 pt-4">
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <span>Continue to Application</span>
          <ChevronRight className="ml-1.5 -mr-1 w-4 h-4" />
        </Link>
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Check className="w-6 h-6" />
              Payment Successful
            </h1>
            <p className="text-sm text-green-100">
              Thank you for your purchase
            </p>
          </div>
          
          {/* Content - Conditionally render based on state */}
          <div className="px-6 py-8">
            {loading 
              ? renderLoading() 
              : error 
                ? renderError() 
                : renderSuccess()}
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact our {' '}
            <a href="mailto:support@intel.aero" className="text-blue-600 hover:underline">
              support team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main page component with Suspense boundary
 * This is the default export that Next.js will use
 */
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessLoading />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}