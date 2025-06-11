// src/app/utils/kv-storage.ts

/**
 * Vercel KV Storage utility for access codes
 * 
 * This utility provides an abstraction layer for storing and retrieving
 * access codes and their metadata using Vercel KV (Redis).
 * 
 * If KV is not available (e.g., in development), it falls back to a local
 * encrypted JSON file for storage.
 */

import { kv } from '@vercel/kv';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { AccessCodeMetadata } from './codeGenerator';

// Constants
const CODE_PREFIX = 'access-code:';
const LOCAL_STORAGE_PATH = path.join(process.cwd(), '.codes-store.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-encryption-key-change-in-prod';

/**
 * Checks if Vercel KV is available
 */
async function isKVAvailable() {
  if (!process.env.KV_URL || !process.env.KV_REST_API_URL) {
    return false;
  }
  
  try {
    await kv.ping();
    return true;
  } catch (error) {
    console.warn('Vercel KV not available, falling back to local storage');
    return false;
  }
}

/**
 * Encrypts data for local storage
 */
function encryptData(data: any): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc', 
    Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
    iv
  );
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts data from local storage
 */
function decryptData(encryptedData: string): any {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc', 
    Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
    iv
  );
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

/**
 * Gets local storage data
 */
async function getLocalStorage(): Promise<Record<string, AccessCodeMetadata>> {
  try {
    const exists = await fs.access(LOCAL_STORAGE_PATH)
      .then(() => true)
      .catch(() => false);
    
    if (!exists) {
      return {};
    }
    
    const data = await fs.readFile(LOCAL_STORAGE_PATH, 'utf8');
    if (!data.trim()) {
      return {};
    }
    
    return decryptData(data);
  } catch (error) {
    console.error('Error reading local storage:', error);
    return {};
  }
}

/**
 * Saves data to local storage
 */
async function saveLocalStorage(data: Record<string, AccessCodeMetadata>): Promise<void> {
  try {
    const encrypted = encryptData(data);
    await fs.writeFile(LOCAL_STORAGE_PATH, encrypted, 'utf8');
  } catch (error) {
    console.error('Error writing to local storage:', error);
    throw error;
  }
}

/**
 * Stores an access code
 */
export async function storeAccessCode(
  codeHash: string, 
  metadata: AccessCodeMetadata
): Promise<void> {
  const key = `${CODE_PREFIX}${codeHash}`;
  
  if (await isKVAvailable()) {
    // Store in Vercel KV
    await kv.set(key, JSON.stringify(metadata));
  } else {
    // Store in local encrypted file
    const storage = await getLocalStorage();
    storage[key] = metadata;
    await saveLocalStorage(storage);
  }
}

/**
 * Retrieves access code metadata
 * FIXED: Handles both string and object responses from Vercel KV
 */
export async function getAccessCode(
  codeHash: string
): Promise<AccessCodeMetadata | null> {
  const key = `${CODE_PREFIX}${codeHash}`;
  
  if (await isKVAvailable()) {
    // Get from Vercel KV - remove type assertion since it can return objects
    const data = await kv.get(key);
    
    if (!data) return null;
    
    // Handle both string and object responses
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error('Error parsing stored JSON:', error);
        console.error('Invalid JSON data:', data);
        return null;
      }
    } else if (typeof data === 'object' && data !== null) {
      // Data is already an object, return it directly
      return data as AccessCodeMetadata;
    } else {
      console.error('Unexpected data type from KV:', typeof data, data);
      return null;
    }
  } else {
    // Get from local encrypted file
    const storage = await getLocalStorage();
    return storage[key] || null;
  }
}

/**
 * Updates access code metadata
 * FIXED: Improved error handling and JSON processing
 */
export async function updateAccessCode(
  codeHash: string,
  updates: Partial<AccessCodeMetadata>
): Promise<boolean> {
  const key = `${CODE_PREFIX}${codeHash}`;
  
  if (await isKVAvailable()) {
    // Update in Vercel KV
    const data = await kv.get(key);
    if (!data) return false;
    
    let existingMetadata: AccessCodeMetadata;
    
    // Handle both string and object responses
    if (typeof data === 'string') {
      try {
        existingMetadata = JSON.parse(data);
      } catch (error) {
        console.error('Error parsing existing JSON during update:', error);
        return false;
      }
    } else if (typeof data === 'object' && data !== null) {
      existingMetadata = data as AccessCodeMetadata;
    } else {
      console.error('Unexpected data type during update:', typeof data);
      return false;
    }
    
    const metadata = { ...existingMetadata, ...updates };
    await kv.set(key, JSON.stringify(metadata));
    return true;
  } else {
    // Update in local encrypted file
    const storage = await getLocalStorage();
    if (!storage[key]) return false;
    
    storage[key] = { ...storage[key], ...updates };
    await saveLocalStorage(storage);
    return true;
  }
}

/**
 * Marks an access code as used
 */
export async function markCodeAsUsed(
  codeHash: string
): Promise<boolean> {
  return updateAccessCode(codeHash, {
    isUsed: true,
    usedAt: new Date().toISOString()
  });
}