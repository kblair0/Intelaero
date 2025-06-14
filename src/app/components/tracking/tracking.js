// tracking.js
/**
 * Purpose: Handles event tracking via Google Forms submission using fetch API
 * Related to: AnalysisWizard.tsx, any component using trackEvent
 * Dependencies: Modern browser with fetch support (all current browsers)
 * Cost implications: Google Forms is free for basic usage (up to 1M responses)
 * 
 * This implementation uses fetch instead of iframe to avoid console warnings
 * and provides better error handling and performance.
 */

/**
 * Main tracking function - submits events to Google Forms
 * @param {string} eventName - Name of the event being tracked
 * @param {Object} additionalData - Additional data to track (optional)
 */
export const trackEventWithForm = (eventName, additionalData = {}) => {
  // Skip tracking in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.REACT_APP_ENABLE_TRACKING) {
    console.log('📊 Tracking (dev mode):', eventName, additionalData);
    return;
  }

  try {
    // Google Form's "formResponse" URL
    const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSe5Des09Yq8IRnPmTyiIlAjXQPpoauiD1oWfgDHZdogGgwEtw/formResponse";
    
    // Map your data to the form fields using the entry IDs from your pre-filled link
    const formData = {
      "entry.1568339444": new Date().toISOString(), // Timestamp field
      "entry.1539634642": eventName,                  // Event Name field
      "entry.1014763706": additionalData.panel || "", // Panel field
    };

    // Use fetch API for cleaner submission (no iframe needed)
    submitViaFetch(formUrl, formData, eventName);
    
  } catch (error) {
    // Fail silently in production to not break user experience
    if (process.env.NODE_ENV === 'development') {
      console.error('Tracking error:', error);
    }
  }
};

/**
 * Submit tracking data using fetch API (cleaner, no console warnings)
 * @param {string} formUrl - Google Form submission URL
 * @param {Object} formData - Form data to submit
 * @param {string} eventName - Event name for logging
 */
const submitViaFetch = (formUrl, formData, eventName) => {
  // Convert form data to URL search params
  const searchParams = new URLSearchParams();
  Object.keys(formData).forEach(key => {
    searchParams.append(key, formData[key]);
  });

  // Submit using fetch with no-cors mode (required for Google Forms)
  fetch(formUrl, {
    method: 'POST',
    mode: 'no-cors', // Required for Google Forms CORS policy
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: searchParams
  })
  .then(() => {
    // Success - log only in development
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Event tracked:', eventName);
    }
  })
  .catch(error => {
    // Error handling - log only in development
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Tracking failed:', eventName, error);
    }
  });
};

/**
 * Enhanced tracking with additional context (optional)
 * @param {string} eventName - Name of the event
 * @param {Object} additionalData - Additional data to track
 */
export const trackEventWithContext = (eventName, additionalData = {}) => {
  const enhancedData = {
    ...additionalData,
    timestamp: new Date().toISOString(),
    url: window.location.pathname, // Track page/route
    userAgent: navigator.userAgent.substring(0, 100), // Truncated for brevity
  };
  
  trackEventWithForm(eventName, enhancedData);
};

/**
 * Batch tracking for multiple events (future enhancement)
 * @param {Array} events - Array of {eventName, additionalData} objects
 */
export const trackBatchEvents = (events) => {
  events.forEach(({ eventName, additionalData = {} }) => {
    // Add small delay to avoid overwhelming the form
    setTimeout(() => {
      trackEventWithForm(eventName, additionalData);
    }, Math.random() * 100); // Random delay 0-100ms
  });
};

// Export default for convenience
export default trackEventWithForm;