// src/app/payment/success/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Copy, ChevronRight, Loader } from 'lucide-react';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retries, setRetries] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  
  // Get session ID from URL
  const sessionId = searchParams.get('session_id');
  const productId = searchParams.get('product_id');
  
  // Fetch session details to get the access code
  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session ID');
      setLoading(false);
      return;
    }
    
    async function fetchSessionDetails() {
      try {
        const response = await fetch(`/api/stripe/session?id=${sessionId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch session details');
        }
        
        const data = await response.json();
        
        if (data.accessCode) {
          setAccessCode(data.accessCode);
          setProductName(data.productName || 'Premium Access');
          setLoading(false);
          setIsWaiting(false);
        } else {
          // If no access code yet, and we haven't exceeded retries
          if (retries < 5) {
            console.log(`No access code found yet. Retry ${retries + 1}/5 in 2 seconds...`);
            setIsWaiting(true);
            // Wait 2 seconds before trying again
            setTimeout(() => {
              setRetries(prev => prev + 1);
            }, 2000);
          } else {
            // After 5 retries (10 seconds), show error
            setError('Access code not found. The webhook might still be processing. Please refresh the page in a few moments or contact support.');
            setLoading(false);
            setIsWaiting(false);
          }
        }
      } catch (error) {
        console.error('Error fetching session details:', error);
        setError('Failed to retrieve your access code. Please contact support.');
        setLoading(false);
        setIsWaiting(false);
      }
    }
    
    fetchSessionDetails();
  }, [sessionId, retries]); // Re-run when retries changes
  
  // Copy access code to clipboard
  const copyToClipboard = () => {
    if (accessCode) {
      navigator.clipboard.writeText(accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
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
          
          {/* Content */}
          <div className="px-6 py-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="mt-4 text-gray-600">
                  {isWaiting ? 
                    `Waiting for access code to be ready... (${retries}/5)` : 
                    'Retrieving your access code...'}
                </p>
              </div>
            ) : error ? (
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
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-500 mb-4">
                    <Check className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-medium text-gray-900 mb-2">
                    {productName} Activated
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
                      {accessCode}
                    </div>
                    <button
                      onClick={copyToClipboard}
                      className={`px-4 py-2 rounded-r-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        copied
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {copied ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Keep this code safe. You'll need it to activate your premium features.
                  </p>
                </div>
                
                {/* Instructions */}
                <div className="rounded-md bg-blue-50 p-4 border border-blue-200">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">
                    How to activate your premium features:
                  </h3>
                  <ol className="space-y-1 text-sm text-blue-700 ml-4 list-decimal">
                    <li>Go to any premium feature in the application</li>
                    <li>Click the feature to open the upgrade modal</li>
                    <li>Select the "Enter Access Code" tab</li>
                    <li>Enter your code and click "Activate"</li>
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
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact our {' '}
            <a href="mailto:support@domain.com" className="text-blue-600 hover:underline">
              support team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}