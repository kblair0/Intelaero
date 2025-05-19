// /api/stripe/get-products/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function GET() {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    // Fetch active products with prices
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
    });
    
    // Filter for products with prices
    const productsWithPrices = products.data.filter(
      product => !!product.default_price
    );
    
    // Log metadata to verify
    productsWithPrices.forEach(product => {
      console.log(`Product: ${product.name}, Metadata:`, product.metadata);
    });
    
    console.log('Fetched products:', productsWithPrices.length);
    
    return NextResponse.json({ products: productsWithPrices });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}