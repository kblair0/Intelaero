// src/app/api/validate-code/route.ts

/**
 * Access code validation API endpoint
 * 
 * Validates the submitted access code and returns tier level and expiration info.
 * Handles code validation, expiration checking, and usage status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  isValidCodeFormat, 
  hashAccessCode 
} from '../../utils/codeGenerator';
import { 
  getAccessCode, 
  markCodeAsUsed 
} from '../../utils/kv-storage';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { code } = body;
    
    // Validate request
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, message: 'Invalid request. Access code is required.' },
        { status: 400 }
      );
    }
    
    // Validate code format
    if (!isValidCodeFormat(code)) {
      return NextResponse.json(
        { valid: false, message: 'Invalid code format. Please check and try again.' },
        { status: 400 }
      );
    }
    
    // Hash code for lookup
    const codeHash = hashAccessCode(code);
    
    // Look up code
    const codeData = await getAccessCode(codeHash);
    
    // Check if code exists
    if (!codeData) {
      return NextResponse.json(
        { valid: false, message: 'Invalid access code. Code not found.' },
        { status: 400 }
      );
    }
    
    // Check if code has been used already
    if (codeData.isUsed) {
      return NextResponse.json(
        { valid: false, message: 'This access code has already been used.' },
        { status: 400 }
      );
    }
    
    // Check if code has expired
    if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date()) {
      return NextResponse.json(
        { valid: false, message: 'This access code has expired.' },
        { status: 400 }
      );
    }
    
    // Mark code as used
    await markCodeAsUsed(codeHash);
    
    // Return successful response
    return NextResponse.json({
      valid: true,
      tierLevel: codeData.tierLevel,
      expiresAt: codeData.expiresAt,
      message: 'Access code validated successfully.'
    });
    
  } catch (error) {
    console.error('Error validating access code:', error);
    return NextResponse.json(
      { valid: false, message: 'Server error. Please try again later.' },
      { status: 500 }
    );
  }
}