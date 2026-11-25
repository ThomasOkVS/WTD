import { describe, it, expect } from 'vitest';
import { PALETTE, COLORS } from '../../src/config/palette.js';

describe('palette', () => {
  it('has burgundy', () => {
    expect(PALETTE.burgundy).toBe('#8a1c2b');
    expect(COLORS.burgundy).toBe(0x8a1c2b);
  });
});
