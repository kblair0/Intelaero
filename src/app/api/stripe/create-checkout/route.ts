/**
 * Stripe checkout session creation API endpoint
 * 
 * Creates a Stripe checkout session for purchasing premium access
 * and redirects the user to the Stripe checkout page.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { TierLevel } from '../../../types/PremiumTypes';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as const,
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { productId, featureId } = body;
    console.log('Received request:', { productId, featureId });

    // Validate product ID
    if (!productId) {
      console.log('Validation failed: Product ID is required');
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Fetch product from Stripe
    let product: Stripe.Product;
    try {
      console.log('Fetching product:', productId);
      product = await stripe.products.retrieve(productId);
      console.log('Fetched product:', { id: product.id, name: product.name, active: product.active });
      if (!product.active) {
        console.log('Validation failed: Product is not active');
        return NextResponse.json(
          { error: 'Product is not active' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      console.log('Validation failed: Invalid product ID');
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    // Extract validityDays from product metadata
    const validityDays = product.metadata?.validityDays || '365';

    // Fetch active prices for the product
    console.log('Fetching prices for product:', productId);
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });
    console.log('Fetched prices:', prices.data.length, prices.data.map(p => ({ id: p.id, active: p.active })));

    if (!prices.data.length) {
      console.log('Validation failed: No active price found for this product');
      return NextResponse.json(
        { error: 'No active price found for this product' },
        { status: 400 }
      );
    }

    const price = prices.data[0];

    // Map productId to tierLevel - FIXED TO PREVENT UNDEFINED
    console.log('Available TierLevel values:', { FREE: TierLevel.FREE, COMMUNITY: TierLevel.COMMUNITY, COMMERCIAL: TierLevel.COMMERCIAL });

    // Define valid product IDs for each tier
    const COMMUNITY_PRODUCT_IDS = [
      'prod_SL53TJIs0Fup3h', // DroneView Local Safety Subscription
    ];
    const COMMERCIAL_PRODUCT_IDS = [
      'prod_NFFWRYSXrISHVK', // Full Droneview Commercial Subscription
      'prod_SRKdN515lrJ343', // Conference Demo - Free
    ];

    // Ensure we have a valid TierLevel by using explicit checks
    let tierLevel: TierLevel;
    if (COMMUNITY_PRODUCT_IDS.includes(productId)) {
      tierLevel = TierLevel.COMMUNITY;
    } else if (COMMERCIAL_PRODUCT_IDS.includes(productId)) {
      tierLevel = TierLevel.COMMERCIAL;
    } else {
      // Fallback to COMMUNITY tier for unrecognized product IDs
      tierLevel = TierLevel.COMMUNITY;
      console.log('Warning: Unknown product ID, defaulting to COMMUNITY tier:', productId);
    }

    console.log('Input productId:', productId);
    console.log('Mapped tierLevel:', tierLevel);

    // Validate tierLevel is not undefined before proceeding
    if (tierLevel === undefined || tierLevel === null) {
      console.error('ERROR: tierLevel is undefined! Using COMMUNITY as fallback');
      tierLevel = TierLevel.COMMUNITY;
    }

    // Define success and cancel URLs
    const origin = request.headers.get('origin') || process.env.APP_URL || 'http://localhost:3000';
    const success_url = `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&product_id=${productId}`;
    const cancel_url = `${origin}${featureId ? '?cancelled=true&feature=' + featureId : '?cancelled=true'}`;
    console.log('URLs:', { success_url, cancel_url });

    // Create checkout session with safe tierLevel handling
    console.log('Creating checkout session for price:', price.id);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: productId === 'prod_SRKdN515lrJ343' ? 'payment' : 'subscription',
      success_url,
      cancel_url,
      metadata: {
        productId,
        // Ensure tierLevel is valid before converting to string
        tierLevel: tierLevel !== undefined && tierLevel !== null ? String(tierLevel) : String(TierLevel.COMMUNITY),
        featureId: featureId || '',
        validityDays: validityDays,
      },
    });

    console.log('Checkout session created:', session.id, session.url);
    // Return checkout URL
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error.message, error.stack);
    return NextResponse.json(
      { error: `Failed to create checkout session: ${error.message}` },
      { status: 500 }
    );
  }
}