// src/app/utils/codeGenerator.ts

/**
 * Access code generation and validation utilities
 * 
 * Provides functions for generating memorable access codes,
 * validating code formats, and working with code metadata.
 */

import crypto from 'crypto';

// Constants for code generation
const CODE_PREFIX_WORDS = [
  'blue', 'red', 'green', 'gold', 'silver', 
  'alpha', 'beta', 'delta', 'echo', 'fox',
  'sky', 'star', 'cloud', 'wind', 'storm',
  'eagle', 'hawk', 'swift', 'rapid', 'pulse'
];

const CODE_SUFFIX_WORDS = [
  'falcon', 'hawk', 'eagle', 'phoenix', 'titan',
  'voyager', 'ranger', 'hunter', 'scout', 'pilot',
  'rover', 'rider', 'flyer', 'glider', 'horizon',
  'vector', 'vista', 'summit', 'peak', 'zenith'
];

/**
 * Code metadata interface
 */
export interface AccessCodeMetadata {
  tierLevel: number;
  expiresAt: string | null; // ISO date string
  issuedAt: string; // ISO date string
  isUsed: boolean;
  usedAt?: string; // ISO date string
  productId: string;
  email?: string; // Optional email of purchaser
}

/**
 * Generates a random, memorable access code
 * Format: PREFIX-SUFFIX-1234
 */
export function generateAccessCode(): string {
  const prefix = CODE_PREFIX_WORDS[Math.floor(Math.random() * CODE_PREFIX_WORDS.length)];
  const suffix = CODE_SUFFIX_WORDS[Math.floor(Math.random() * CODE_SUFFIX_WORDS.length)];
  const numbers = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  
  return `${prefix}-${suffix}-${numbers}`.toUpperCase();
}

/**
 * Creates a hashed version of an access code for secure storage
 */
export function hashAccessCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code.toLowerCase().trim())
    .digest('hex');
}

/**
 * Validates access code format
 */
export function isValidCodeFormat(code: string): boolean {
  // Basic format validation: PREFIX-SUFFIX-1234
  const regex = /^[A-Za-z]+-[A-Za-z]+-\d{4}$/;
  return regex.test(code.trim());
}

/**
 * Creates access code metadata for a new code
 */
export function createCodeMetadata(
  tierLevel: number, 
  productId: string,
  validityDays: number = 365,
  email?: string
): AccessCodeMetadata {
  const issuedAt = new Date().toISOString();
  const expiresAt = validityDays > 0 
    ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  
  return {
    tierLevel,
    expiresAt,
    issuedAt,
    isUsed: false,
    productId,
    email
  };
}