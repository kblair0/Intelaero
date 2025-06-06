/**
 * src/app/components/UI/UpgradeModal.tsx
 * 
 * Purpose:
 * A generic upgrade modal that informs users about premium features and provides
 * options to enter access codes or initiate purchase flow.
 * 
 * This simplified version doesn't require updates when adding new premium features.
 */

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { usePremium, TierLevel } from '../../context/PremiumContext';
import { X, Lock, CreditCard, Key, AlertCircle, Check, Loader, Info, ChevronRight } from 'lucide-react';
import { TIER_CONFIG } from '../../utils/premiumConfig';

// Modal component
const UpgradeModal: React.FC = () => {
  // State
  const [accessCode, setAccessCode] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [mode, setMode] = useState<'code' | 'purchase' | 'compare'>('code');
  
  // Get premium context
  const {
    isModalOpen, 
    closeModal, 
    attemptedFeature,
    validateAccessCode,
    validationLoading,
    validationError,
    tierLevel,
    getTierName,
    getRequiredTierForFeature,
    getRemainingDays
  } = usePremium();

  // Get products from Stripe
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Calculate the required tier accurately
  const requiredTier = useMemo(() => {
    if (!attemptedFeature) return TierLevel.COMMUNITY;
    
    // For marker features, determine based on marker limits
    if (attemptedFeature.startsWith('add_')) {
      const markerType = attemptedFeature.replace('add_', '') as 'gcs' | 'observer' | 'repeater';
      
      // Find the lowest tier that allows this marker type
      for (let tier = TierLevel.FREE; tier <= TierLevel.COMMERCIAL; tier++) {
        if (TIER_CONFIG[tier].maxMarkers[markerType] > 0) {
          return tier;
        }
      }
      return TierLevel.COMMERCIAL;
    }
    
    // For regular features, use the standard function
    return getRequiredTierForFeature(attemptedFeature);
  }, [attemptedFeature, getRequiredTierForFeature]);

  // Get the name of the required tier
  const requiredTierName = getTierName(requiredTier);
  
  // Get a user-friendly feature name
  const featureName = useMemo(() => {
    if (!attemptedFeature) return "Premium Feature";
    
    // For marker features
    if (attemptedFeature.startsWith('add_')) {
      const markerType = attemptedFeature.replace('add_', '');
      const typeNames = {
        'gcs': 'Ground Station',
        'observer': 'Observer',
        'repeater': 'Repeater'
      };
      return `Add ${typeNames[markerType] || markerType} Marker`;
    }
    
    // For other features, format the feature ID
    return attemptedFeature
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [attemptedFeature]);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const response = await fetch('/api/stripe/get-products');
        const data = await response.json();
        setProducts(data.products);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    }
    
    if (isModalOpen && mode === 'purchase') {
      fetchProducts();
    }
  }, [isModalOpen, mode]);

  // Reset state when modal opens Default View is enter code
  useEffect(() => {
    if (isModalOpen) {
      setAccessCode('');
      setSelectedProduct(null);
      setMode('code');
    }
  }, [isModalOpen]);

  // Pre-select appropriate product based on required tier
  useEffect(() => {
    if (isModalOpen && requiredTier) {
      if (requiredTier === TierLevel.COMMUNITY) {
        setSelectedProduct('prod_SL53TJIs0Fup3h');
      } else if (requiredTier === TierLevel.COMMERCIAL) {
        setSelectedProduct('prod_NFFWRYSXrISHVK');
      }
    }
  }, [isModalOpen, requiredTier]);

  // Handle access code submission
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    
    await validateAccessCode(accessCode.trim());
  };

  // Handle Stripe checkout
  const handleCheckout = async () => {
    if (!selectedProduct) {
      console.error('No product selected');
      alert('Please select a product');
      return;
    }
    
    console.log('Sending productId:', selectedProduct);
    setCheckoutLoading(true);
    
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: selectedProduct
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout error:', errorData.error);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }
      
      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert(`Checkout failed: ${error.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // If modal is closed, don't render anything
  if (!isModalOpen) return null;

  // Calculate remaining days for subscription
  const remainingDays = getRemainingDays();

  // Get limits for marker types if this is a marker feature
  let markerLimits = null;
  if (attemptedFeature && attemptedFeature.startsWith('add_')) {
    const markerType = attemptedFeature.replace('add_', '') as 'gcs' | 'observer' | 'repeater';
    markerLimits = {
      current: TIER_CONFIG[tierLevel].maxMarkers[markerType],
      required: TIER_CONFIG[requiredTier].maxMarkers[markerType]
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-200" />
              <h2 className="text-lg font-semibold">Premium Feature</h2>
            </div>
            <button
              onClick={closeModal}
              className="p-1 rounded-full text-gray-100 hover:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Feature context */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full text-blue-700 text-xl">
              <span role="img" aria-label="premium">⭐️</span>
            </div>
            <div className="w-full">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-900 text-lg">{featureName}</h3>
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                  <Info className="w-3.5 h-3.5" />
                  <span>Requires {requiredTierName} Tier</span>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mt-1">
                {markerLimits ? (
                  <>
                    Your current {getTierName()} plan allows {markerLimits.current} of these markers. 
                    {requiredTierName} tier allows {markerLimits.required}.
                  </>
                ) : (
                  `This feature requires the ${requiredTierName} tier or higher to access.`
                )}
              </p>
            </div>
          </div>
          
          {/* Current tier status */}
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">Your Current Tier: </p>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">{getTierName()} Plan</span>
                  {tierLevel < requiredTier && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                      Upgrade needed
                    </span>
                  )}
                  {tierLevel >= requiredTier && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">
                      <Check className="inline w-3 h-3 mr-0.5" />
                      Access granted
                    </span>
                  )}
                </div>
              </div>
              {tierLevel > TierLevel.FREE && remainingDays !== null && (
                <div className="text-right">
                  <p className="text-xs text-gray-600">Time Remaining</p>
                  <p className="text-sm font-medium text-gray-900">{remainingDays} days</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 sticky top-[92px] z-10 bg-white">
          <button
            className={`flex-1 py-3 text-sm font-medium ${
              mode === 'code' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setMode('code')}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Key className="w-4 h-4" />
              <span>Use Access Code</span>
            </div>
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium ${
              mode === 'purchase' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setMode('purchase')}
          >
            <div className="flex items-center justify-center gap-1.5">
              <CreditCard className="w-4 h-4" />
              <span>Purchase</span>
            </div>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-2">
          {mode === 'code' && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label htmlFor="access-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Access Code
                </label>
                <input
                  type="text"
                  id="access-code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Enter your access code"
                  disabled={validationLoading}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the code you received after purchase or from your administrator.
                </p>
              </div>
              
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{validationError}</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('purchase')}
                  className="flex-1 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Need a Code?
                </button>
                <button
                  type="submit"
                  disabled={!accessCode.trim() || validationLoading}
                  className={`flex-1 py-2 rounded-md text-sm font-medium text-white ${
                    !accessCode.trim() || validationLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                  }`}
                >
                  {validationLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Validating...</span>
                    </div>
                  ) : (
                    'Activate'
                  )}
                </button>
              </div>
            </form>
          )}
          
          {mode === 'purchase' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-2">
                Select a plan to unlock premium features:
              </p>
              
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                    <p className="mt-2 text-gray-600">Loading subscription plans...</p>
                  </div>
                ) : (
                  products.map((product) => (
                    <div
                      key={product.id}
                      className={`border text-sm text-bold rounded-md p-2 cursor-pointer transition-all ${
                        selectedProduct === product.id
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                      }`}
                      onClick={() => setSelectedProduct(product.id)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            {(product.default_price.unit_amount / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {product.default_price.recurring
                              ? `${product.default_price.recurring.interval_count} ${product.default_price.recurring.interval}`
                              : 'One-time purchase'}
                          </p>
                        </div>
                      </div>

                      {/* Display Description from metadata */}
                      <div className="mb-2">
                        <p className="text-xs text-gray-900 flex items-center gap-1">
                          {product.metadata.description || 'No description available'}
                        </p>
                      </div>
                      
                      {/* Display features from product metadata or description */}
                      <div className="mb-2">
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                          Features
                        </p>
                       {product.metadata.features && (
                          <ul className="space-y-1">
                            {product.metadata.features.split(',').map((feature, index) => (
                              <li key={index} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <Check className="w-3.5 h-3.5 text-green-500" />
                                <span>{feature.trim()}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="pt-3">
                <button
                  onClick={handleCheckout}
                  disabled={!selectedProduct || checkoutLoading}
                  className={`w-full py-2.5 rounded-md text-sm font-medium text-white ${
                    !selectedProduct || checkoutLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                  }`}
                >
                  {checkoutLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    'Continue to Checkout'
                  )}
                </button>
                
                <p className="text-xs text-gray-500 mt-2 flex items-center justify-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  Secure payment processing via Stripe
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t text-center text-xs text-gray-500 sticky bottom-0">
          Questions? Contact <a href="mailto:support@intel.aero" className="text-blue-600 hover:underline">support@intel.aero</a>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;