// src/app/api/stripe/webhook/route.ts

/**
 * Stripe webhook handler API endpoint
 *
 * Processes webhook events from Stripe, particularly focusing on
 * successful payment events to generate and store access codes.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  generateAccessCode,
  hashAccessCode,
  createCodeMetadata
} from '../../../utils/codeGenerator';
import { storeAccessCode } from '../../../utils/kv-storage';
import { TierLevel } from '../../../context/PremiumContext';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as const,
});

// Valid product IDs and their corresponding tier levels
const VALID_PRODUCTS = {
  'prod_SL53TJIs0Fup3h': {
    name: 'DroneView Local Safety',
    tierLevel: TierLevel.COMMUNITY
  },
  'prod_NFFWRYSXrISHVK': {
    name: 'Full Droneview Commercial',
    tierLevel: TierLevel.COMMERCIAL
  },
  'prod_SRKdN515lrJ343': {
    name: 'Conference Demo - Free',
    tierLevel: TierLevel.COMMERCIAL  // Commercial tier for demo
  }
};

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Webhook endpoint is working!',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  console.log('=== WEBHOOK DEBUG START ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;
  
  console.log('Body length:', body.length);
  console.log('Signature present:', !!signature);
  console.log('Webhook secret present:', !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log('=== WEBHOOK DEBUG END ===');
  
  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    
    console.log(`Webhook event type: ${event.type}`);
    
    // Handle checkout session completed event
    if (event.type === 'checkout.session.completed') {
      await handleSuccessfulPayment(event.data.object as Stripe.Checkout.Session);
    }
    
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { error: 'Webhook handler failed', message: error.message },
      { status: 400 }
    );
  }
}

/**
 * Handles successful payment by generating an access code
 */
async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  try {
    console.log('Processing successful payment for session:', session.id);
    
    // Extract metadata
    console.log('Session metadata:', session.metadata);
    const { productId, tierLevel: tierLevelString, validityDays: validityDaysString } = session.metadata || {};
    
    if (!productId) {
      console.error('Missing productId in session metadata');
      return;
    }
    
    // Get customer email
    const customerEmail = session.customer_details?.email;
    console.log('Customer email:', customerEmail);
    
    // Verify product exists and determine tier level
    let tierLevel: number;
    
    if (productId && productId in VALID_PRODUCTS) {
      const product = VALID_PRODUCTS[productId as keyof typeof VALID_PRODUCTS];
      console.log(`Valid product found: ${productId} (${product.name})`);
      tierLevel = product.tierLevel;
    } else if (tierLevelString) {
      // Fallback to provided tier level if product not recognized
      console.log(`Product not recognized but tierLevel provided: ${tierLevelString}`);
      tierLevel = parseInt(tierLevelString, 10);
      
      // Validate tier level is within expected range
      if (tierLevel < TierLevel.FREE || tierLevel > TierLevel.COMMERCIAL) {
        console.error(`Invalid tier level: ${tierLevel}, defaulting to COMMUNITY`);
        tierLevel = TierLevel.COMMUNITY;
      }
    } else {
      console.error('Invalid product ID and no tier level in session:', session.id);
      // Default to COMMUNITY tier if all else fails
      tierLevel = TierLevel.COMMUNITY;
    }
    
    console.log(`Using tier level: ${tierLevel}`);
    
    // Parse validity days with a default of 365 if not specified
    const validityDays = validityDaysString ? parseInt(validityDaysString, 10) : 365;
    console.log(`Validity days: ${validityDays}`);
    
    // Generate a unique access code
    let accessCode = generateAccessCode();
    let codeHash = hashAccessCode(accessCode);
    console.log('Generated access code (hashed):', codeHash);
    
    // Create code metadata
    const codeMetadata = createCodeMetadata(
      tierLevel,
      productId,
      validityDays,
      customerEmail || undefined
    );
    
    console.log('Code metadata:', {
      tierLevel: codeMetadata.tierLevel,
      expiresAt: codeMetadata.expiresAt,
      issuedAt: codeMetadata.issuedAt,
      productId: codeMetadata.productId
    });
    
    // Store the access code
    try {
      console.log('Storing access code...');
      let existingCode = await storeAccessCode(codeHash, codeMetadata).catch(error => {
        console.error('Error storing access code:', error);
        return true;
      });
      
      // If there was an error storing the code, generate a new one and try again
      if (existingCode === true) {
        console.log('Error or duplicate code found, generating a new code');
        accessCode = generateAccessCode();
        codeHash = hashAccessCode(accessCode);
        
        await storeAccessCode(codeHash, {
          ...codeMetadata,
          issuedAt: new Date().toISOString() // Update the issued timestamp
        });
        console.log('New code stored successfully');
      }
    } catch (error) {
      console.error('Final error storing access code:', error);
      throw new Error(`Failed to store access code: ${error instanceof Error ? error.message : 'Unknown error'}`);

    }
    
    // Update the Stripe session with the access code
    try {
      console.log('Updating session with access code...');
      await stripe.checkout.sessions.update(session.id, {
        metadata: {
          ...session.metadata,
          accessCode
        }
      });
      console.log('Session updated successfully with access code');
    } catch (error) {
      console.error('Error updating session with access code:', error);
      throw new Error(`Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Log successful completion
    console.log(`Successfully processed payment for ${customerEmail || 'unknown customer'}`);
    console.log(`Access code ${accessCode} generated and stored`);
    
  } catch (error: any) {
    console.error('Error handling successful payment:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}