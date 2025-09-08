import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface ExtractedAuthDetails {
  account: string;
  project: string;
  token: string;
  adcFilePath: string;
  adcContent?: any;
  hasValidADC: boolean;
  quotaProject?: string;
}

/**
 * Extract current ADC and gcloud authentication details for testing
 * This is used to create test scenarios without disrupting the user's setup
 */
export async function extractCurrentAuthDetails(): Promise<ExtractedAuthDetails> {
  let account = '';
  let project = '';
  let token = '';
  let hasValidADC = false;
  let adcContent: any;

  // Get active gcloud account
  try {
    account = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    account = 'unknown@example.com';
  }

  // Get current project
  try {
    project = execSync('gcloud config get-value project', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    project = 'test-project';
  }

  // Get current access token
  try {
    token = execSync('gcloud auth application-default print-access-token --quiet', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    hasValidADC = token.startsWith('ya29.');
  } catch {
    token = 'fake-token-for-testing';
  }

  // Check ADC file
  const adcFilePath = join(homedir(), '.config', 'gcloud', 'application_default_credentials.json');
  if (existsSync(adcFilePath)) {
    try {
      adcContent = JSON.parse(readFileSync(adcFilePath, 'utf8'));
    } catch {
      // ignore parse errors
    }
  }

  return {
    account,
    project,
    token,
    adcFilePath,
    adcContent,
    hasValidADC,
    quotaProject: process.env.GOOGLE_ADS_QUOTA_PROJECT_ID,
  };
}

/**
 * Create a test environment with specific auth overrides
 * Returns a cleanup function to restore original env
 */
export function createTestAuthEnv(overrides: Partial<NodeJS.ProcessEnv>): () => void {
  const originalEnv: Record<string, string | undefined> = {};
  
  // Store original values
  for (const key in overrides) {
    originalEnv[key] = process.env[key];
  }

  // Apply overrides
  Object.assign(process.env, overrides);

  // Return cleanup function
  return () => {
    for (const key in overrides) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  };
}

/**
 * Generate a fake but realistic-looking access token for testing
 */
export function generateFakeToken(prefix = 'ya29.test'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = prefix + '.';
  for (let i = 0; i < 120; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}