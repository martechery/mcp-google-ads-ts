export function validateSessionKey(key: string): void {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidV4Regex.test(key)) {
    throw new Error('Session key must be UUID v4 format');
  }
}

