import { describe, it, expect } from 'vitest';
import { formatCustomerId } from '../src/utils/formatCustomerId.js';

describe('formatCustomerId', () => {
  it('pads to 10 digits and strips non-digits', () => {
    expect(formatCustomerId('123-456-7890')).toBe('1234567890');
    expect(formatCustomerId('"0012345678"')).toBe('0012345678');
    expect(formatCustomerId('{9873 186 703}')).toBe('9873186703');
    expect(formatCustomerId(12345)).toBe('0000012345');
  });
});

