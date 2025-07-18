import { describe, it, expect } from 'vitest';
import { truncateWords } from './text';

describe('truncateWords', () => {
  it('returns empty string when input is null', () => {
    expect(truncateWords(null, 4)).toBe('');
  });

  it('returns empty string when input is undefined', () => {
    expect(truncateWords(undefined, 4)).toBe('');
  });

  it('returns original string when word count is less than or equal to limit', () => {
    expect(truncateWords('one two three', 4)).toBe('one two three');
    expect(truncateWords('one two three four', 4)).toBe('one two three four');
  });

  it('truncates to the specified number of words and adds ellipsis', () => {
    expect(truncateWords('one two three four five six', 4)).toBe('one two three four...');
  });
});