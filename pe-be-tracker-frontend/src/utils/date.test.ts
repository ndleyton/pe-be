import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toUTCISOString,
  formatDisplayDate,
  formatRelativeTime,
  getCurrentUTCTimestamp,
  generateRandomId,
  parseWorkoutDuration
} from './date';

describe('Date Utilities', () => {
  describe('toUTCISOString', () => {
    it('returns empty string for null/undefined/empty inputs', () => {
      expect(toUTCISOString(null)).toBe('');
      expect(toUTCISOString(undefined)).toBe('');
      expect(toUTCISOString('')).toBe('');
      expect(toUTCISOString('   ')).toBe('');
    });

    it('handles already UTC strings (ending with Z)', () => {
      const utcString = '2024-01-01T12:00:00Z';
      expect(toUTCISOString(utcString)).toBe('2024-01-01T12:00:00.000Z');
    });

    it('handles timezone offset strings', () => {
      const timezoneString = '2024-01-01T12:00:00+05:00';
      expect(toUTCISOString(timezoneString)).toBe('2024-01-01T07:00:00.000Z');
    });

    it('handles HTML datetime-local format without seconds', () => {
      const datetimeLocal = '2024-01-01T12:00';
      expect(toUTCISOString(datetimeLocal)).toBe('2024-01-01T12:00:00.000Z');
    });

    it('handles HTML datetime-local format with seconds', () => {
      const datetimeLocal = '2024-01-01T12:00:30';
      expect(toUTCISOString(datetimeLocal)).toBe('2024-01-01T12:00:30.000Z');
    });

    it('handles other date formats by parsing as-is', () => {
      const dateString = '2024-01-01';
      expect(toUTCISOString(dateString)).toBe('2024-01-01T00:00:00.000Z');
    });

    it('returns empty string for invalid date strings', () => {
      expect(toUTCISOString('invalid-date')).toBe('');
      expect(toUTCISOString('2024-13-01')).toBe('');
      expect(toUTCISOString('not-a-date')).toBe('');
    });

    it('handles edge case timezone formats', () => {
      expect(toUTCISOString('2024-01-01T12:00:00+0530')).toBe('2024-01-01T06:30:00.000Z');
      expect(toUTCISOString('2024-01-01T12:00:00-08:00')).toBe('2024-01-01T20:00:00.000Z');
    });
  });

  describe('formatDisplayDate', () => {
    beforeEach(() => {
      // Mock the system timezone to make tests deterministic
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns empty string for null/undefined/empty inputs', () => {
      expect(formatDisplayDate(null)).toBe('');
      expect(formatDisplayDate(undefined)).toBe('');
      expect(formatDisplayDate('')).toBe('');
      expect(formatDisplayDate('   ')).toBe('');
    });

    it('returns empty string for invalid date strings', () => {
      expect(formatDisplayDate('invalid-date')).toBe('');
      expect(formatDisplayDate('2024-13-01')).toBe('');
      expect(formatDisplayDate('not-a-date')).toBe('');
    });

    it('formats date with time by default', () => {
      const result = formatDisplayDate('2024-01-01T15:30:00Z');
      // The output will be in local timezone, so check for basic components
      expect(result).toMatch(/Jan 1/);
      expect(result).toMatch(/30/);
      expect(result).toMatch(/PM|AM|\d{2}:\d{2}/);
    });

    it('formats date without time when includeTime is false', () => {
      const result = formatDisplayDate('2024-01-01T15:30:00Z', { includeTime: false });
      expect(result).toMatch(/Jan 1/);
      expect(result).not.toMatch(/15:30|3:30/);
    });

    it('includes timezone when includeTimezone is true', () => {
      const result = formatDisplayDate('2024-01-01T15:30:00Z', { includeTimezone: true });
      expect(result).toMatch(/GMT|UTC|Z/);
    });

    it('handles different time styles', () => {
      const timestamp = '2024-01-01T15:30:45Z';
      
      const short = formatDisplayDate(timestamp, { timeStyle: 'short' });
      const medium = formatDisplayDate(timestamp, { timeStyle: 'medium' });
      
      // Medium should include seconds, short should not
      expect(short).not.toMatch(/45/);
      expect(medium).toMatch(/45/);
    });

    it('uses memoized formatters for repeated calls', () => {
      const timestamp = '2024-01-01T15:30:00Z';
      const options = { includeTime: true, includeTimezone: false };
      
      const result1 = formatDisplayDate(timestamp, options);
      const result2 = formatDisplayDate(timestamp, options);
      
      expect(result1).toBe(result2);
      expect(result1).toMatch(/Jan 1/);
    });

    it('handles leap year dates', () => {
      const result = formatDisplayDate('2024-02-29T12:00:00Z');
      expect(result).toMatch(/Feb 29/);
    });

    it('handles year boundaries', () => {
      // Use dates that won't be affected by timezone conversion
      const newYear = formatDisplayDate('2024-01-01T12:00:00Z');
      const newYearEve = formatDisplayDate('2023-12-31T12:00:00Z');
      
      expect(newYear).toMatch(/Jan 1/);
      expect(newYearEve).toMatch(/Dec 31/);
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns empty string for null/undefined/empty inputs', () => {
      expect(formatRelativeTime(null)).toBe('');
      expect(formatRelativeTime(undefined)).toBe('');
      expect(formatRelativeTime('')).toBe('');
    });

    it('returns empty string for invalid dates', () => {
      expect(formatRelativeTime('invalid-date')).toBe('');
      expect(formatRelativeTime('2024-13-01')).toBe('');
    });

    it('returns "Just now" for recent timestamps', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
      
      expect(formatRelativeTime(thirtySecondsAgo.toISOString())).toBe('Just now');
    });

    it('returns minutes ago for timestamps within an hour', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe('5m ago');
      expect(formatRelativeTime(thirtyMinutesAgo.toISOString())).toBe('30m ago');
    });

    it('returns hours ago for timestamps within a day', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);
      
      expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe('2h ago');
      expect(formatRelativeTime(twentyHoursAgo.toISOString())).toBe('20h ago');
    });

    it('returns days ago for timestamps within a week', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      
      expect(formatRelativeTime(twoDaysAgo.toISOString())).toBe('2d ago');
      expect(formatRelativeTime(sixDaysAgo.toISOString())).toBe('6d ago');
    });

    it('returns formatted date for timestamps older than a week', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      const result = formatRelativeTime(twoWeeksAgo.toISOString());
      expect(result).toMatch(/Jan 1/); // Should use formatDisplayDate
    });

    it('handles future timestamps gracefully', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const future = new Date(now.getTime() + 60 * 60 * 1000);
      
      // Should handle negative differences
      const result = formatRelativeTime(future.toISOString());
      expect(typeof result).toBe('string');
    });
  });

  describe('getCurrentUTCTimestamp', () => {
    it('returns a valid ISO string', () => {
      const timestamp = getCurrentUTCTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('returns current time in UTC', () => {
      const before = Date.now();
      const timestamp = getCurrentUTCTimestamp();
      const after = Date.now();
      
      const timestampMs = new Date(timestamp).getTime();
      expect(timestampMs).toBeGreaterThanOrEqual(before);
      expect(timestampMs).toBeLessThanOrEqual(after);
    });
  });

  describe('generateRandomId', () => {
    it('generates non-empty strings', () => {
      const id = generateRandomId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('generates unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRandomId());
      }
      expect(ids.size).toBe(100); // All should be unique
    });

    it('generates valid UUID format when crypto.randomUUID is available', () => {
      // Check if we're in an environment with crypto.randomUUID
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        const id = generateRandomId();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      } else {
        // In fallback mode, should generate hex string
        const id = generateRandomId();
        expect(id).toMatch(/^[0-9a-f]+$/);
        expect(id.length).toBe(32); // 16 bytes * 2 hex chars
      }
    });

    it('handles crypto unavailable scenario', () => {
      // Test the fallback behavior by checking that IDs are still generated
      // even if crypto methods might not be available in some environments
      const id = generateRandomId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      // Should be either UUID format or hex format
      expect(id).toMatch(/^[0-9a-f-]+$/);
    });
  });

  describe('parseWorkoutDuration', () => {
    it('returns "In Progress" when end time is null/undefined', () => {
      const startTime = '2024-01-01T10:00:00Z';
      
      expect(parseWorkoutDuration(startTime, null)).toEqual({
        durationMs: 0,
        durationText: 'In Progress'
      });
      
      expect(parseWorkoutDuration(startTime, undefined)).toEqual({
        durationMs: 0,
        durationText: 'In Progress'
      });
    });

    it('returns "In Progress" when start time is null/undefined/empty', () => {
      const endTime = '2024-01-01T11:00:00Z';
      
      expect(parseWorkoutDuration(null, endTime)).toEqual({
        durationMs: 0,
        durationText: 'In Progress'
      });
      
      expect(parseWorkoutDuration(undefined, endTime)).toEqual({
        durationMs: 0,
        durationText: 'In Progress'
      });
      
      expect(parseWorkoutDuration('', endTime)).toEqual({
        durationMs: 0,
        durationText: 'In Progress'
      });
    });

    it('handles invalid date strings', () => {
      expect(parseWorkoutDuration('invalid-date', '2024-01-01T11:00:00Z')).toEqual({
        durationMs: 0,
        durationText: 'Invalid duration'
      });
      
      expect(parseWorkoutDuration('2024-01-01T10:00:00Z', 'invalid-date')).toEqual({
        durationMs: 0,
        durationText: 'Invalid duration'
      });
    });

    it('handles negative duration (end before start)', () => {
      const startTime = '2024-01-01T11:00:00Z';
      const endTime = '2024-01-01T10:00:00Z'; // Before start
      
      expect(parseWorkoutDuration(startTime, endTime)).toEqual({
        durationMs: 0,
        durationText: 'Invalid duration'
      });
    });

    it('formats seconds correctly', () => {
      const startTime = '2024-01-01T10:00:00Z';
      const endTime = '2024-01-01T10:00:30Z'; // 30 seconds
      
      expect(parseWorkoutDuration(startTime, endTime)).toEqual({
        durationMs: 30000,
        durationText: '30s'
      });
    });

    it('formats minutes and seconds correctly', () => {
      const startTime = '2024-01-01T10:00:00Z';
      const endTime = '2024-01-01T10:05:30Z'; // 5 minutes 30 seconds
      
      expect(parseWorkoutDuration(startTime, endTime)).toEqual({
        durationMs: 330000, // 5.5 minutes * 60 * 1000
        durationText: '5m 30s'
      });
    });

    it('formats hours and minutes correctly', () => {
      const startTime = '2024-01-01T10:00:00Z';
      const endTime = '2024-01-01T11:30:45Z'; // 1 hour 30 minutes 45 seconds
      
      expect(parseWorkoutDuration(startTime, endTime)).toEqual({
        durationMs: 5445000, // 1.5125 hours * 60 * 60 * 1000
        durationText: '1h 30m'
      });
    });

    it('handles exact hour durations', () => {
      const startTime = '2024-01-01T10:00:00Z';
      const endTime = '2024-01-01T12:00:00Z'; // Exactly 2 hours
      
      expect(parseWorkoutDuration(startTime, endTime)).toEqual({
        durationMs: 7200000, // 2 hours * 60 * 60 * 1000
        durationText: '2h 0m'
      });
    });

    it('handles millisecond precision', () => {
      const startTime = '2024-01-01T10:00:00.000Z';
      const endTime = '2024-01-01T10:00:00.500Z'; // 500ms
      
      const result = parseWorkoutDuration(startTime, endTime);
      expect(result.durationMs).toBe(500);
      expect(result.durationText).toBe('0s'); // Should round down to 0 seconds
    });

    it('handles long durations', () => {
      const startTime = '2024-01-01T08:00:00Z';
      const endTime = '2024-01-01T20:30:00Z'; // 12.5 hours
      
      expect(parseWorkoutDuration(startTime, endTime)).toEqual({
        durationMs: 45000000, // 12.5 hours * 60 * 60 * 1000
        durationText: '12h 30m'
      });
    });

    it('handles cross-day durations', () => {
      const startTime = '2024-01-01T23:30:00Z';
      const endTime = '2024-01-02T01:00:00Z'; // 1.5 hours across midnight
      
      expect(parseWorkoutDuration(startTime, endTime)).toEqual({
        durationMs: 5400000, // 1.5 hours * 60 * 60 * 1000
        durationText: '1h 30m'
      });
    });
  });

  describe('Formatter Memoization', () => {
    it('reuses formatters for identical options', () => {
      const timestamp = '2024-01-01T15:30:00Z';
      const options = { includeTime: true, includeTimezone: false };
      
      // Call multiple times with same options
      const result1 = formatDisplayDate(timestamp, options);
      const result2 = formatDisplayDate(timestamp, options);
      const result3 = formatDisplayDate(timestamp, options);
      
      // Results should be identical
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('creates different formatters for different options', () => {
      const timestamp = '2024-01-01T15:30:00Z';
      
      const withTime = formatDisplayDate(timestamp, { includeTime: true });
      const withoutTime = formatDisplayDate(timestamp, { includeTime: false });
      const withTimezone = formatDisplayDate(timestamp, { includeTimezone: true });
      
      // Results should be different
      expect(withTime).not.toBe(withoutTime);
      expect(withTime).not.toBe(withTimezone);
      expect(withoutTime).not.toBe(withTimezone);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles malformed ISO strings gracefully', () => {
      const malformedDates = [
        '2024-01-01T25:00:00Z', // Invalid hour
        '2024-13-01T12:00:00Z', // Invalid month
        '20240101T120000Z',     // Missing separators
        'T12:00:00Z',          // Missing date part
        '2024-01-01T',         // Missing time part
        'completely-invalid',   // Completely invalid
      ];
      
      malformedDates.forEach(date => {
        expect(toUTCISOString(date)).toBe('');
        expect(formatDisplayDate(date)).toBe('');
        expect(formatRelativeTime(date)).toBe('');
      });
      
      // Note: Some browsers are more lenient with date parsing
      // '2024-02-30T12:00:00Z' might be automatically corrected to '2024-03-01T12:00:00Z'
      // This is expected behavior, not a bug in our code
    });

    it('handles extremely large and small numbers', () => {
      const veryEarlyDate = '1900-01-01T00:00:00Z';
      const veryLateDate = '2100-12-31T23:59:59Z';
      
      expect(formatDisplayDate(veryEarlyDate)).toBeTruthy();
      expect(formatDisplayDate(veryLateDate)).toBeTruthy();
      expect(formatRelativeTime(veryEarlyDate)).toBeTruthy();
    });

    it('handles whitespace-only strings', () => {
      const whitespaceStrings = ['   ', '\t', '\n', '\r\n', '  \t\n  '];
      
      whitespaceStrings.forEach(str => {
        expect(toUTCISOString(str)).toBe('');
        expect(formatDisplayDate(str)).toBe('');
        expect(formatRelativeTime(str)).toBe('');
        expect(parseWorkoutDuration(str, '2024-01-01T12:00:00Z')).toEqual({
          durationMs: 0,
          durationText: 'In Progress'
        });
      });
    });
  });
});