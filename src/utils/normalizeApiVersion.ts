/**
 * Normalizes Google Ads API version to standard format
 * Handles: "21" → "v21", "v21" → "v21", "V21" → "v21"
 */
export function normalizeApiVersion(version?: string): string {
  if (!version) return 'v21';
  
  const normalized = version.toLowerCase().trim();
  
  // Already has v prefix
  if (normalized.startsWith('v')) {
    return normalized;
  }
  
  // Just a number, add v prefix
  if (/^\d+$/.test(normalized)) {
    return `v${normalized}`;
  }
  
  // Fallback to default
  return 'v21';
}