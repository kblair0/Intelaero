// src/app/api/stripe/session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as const,
});

export async function GET(request: NextRequest) {
  try {
    // Get session ID from query string
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    
    console.log('Retrieving session:', sessionId);
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('Session data:', {
      id: session.id,
      hasMetadata: !!session.metadata,
      metadataKeys: session.metadata ? Object.keys(session.metadata) : []
    });
    
    // Extract relevant data
    const { metadata } = session;
    const accessCode = metadata?.accessCode || null;
    const productId = metadata?.productId || null;
    
    // Get product name from productId without using getProductById
    let productName = 'Premium Access';
    if (productId === 'prod_SL53TJIs0Fup3h') {
      productName = 'Community Tier';
    } else if (productId === 'prod_NFFWRYSXrISHVK') {
      productName = 'Commercial Tier';
    }
    
    console.log('Returning session details:', { accessCode: !!accessCode, productName });
    
    // Return session details
    return NextResponse.json({
      accessCode,
      productName,
      tierLevel: metadata?.tierLevel || null
    });
    
  } catch (error) {
    console.error('Detailed session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}