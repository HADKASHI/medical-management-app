import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('runs in the node project', () => {
    expect(typeof window).toBe('undefined');
  });

  it('lets a later Tailwind class win over a conflicting earlier one', () => {
    expect(cn('px-2 text-sm', { hidden: false }, 'px-4')).toBe('text-sm px-4');
  });
});
