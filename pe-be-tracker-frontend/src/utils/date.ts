export const toUTCISOString = (local: string): string => {
  if (!local?.trim()) return '';
  
  // If already has timezone info, parse and convert to UTC
  if (/Z$/i.test(local) || /[+-]\d{2}:?\d{2}$/.test(local)) {
    try {
      return new Date(local).toISOString();
    } catch {
      return '';
    }
  }

  // Handle HTML datetime-local format (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss)
  const datetimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
  if (datetimeLocalRegex.test(local)) {
    const normalized = local.length === 16 ? `${local}:00Z` : `${local}Z`;
    try {
      return new Date(normalized).toISOString();
    } catch {
      return '';
    }
  }

  // For other formats, try to parse as-is and convert to UTC
  try {
    const date = new Date(local);
    return isNaN(date.getTime()) ? '' : date.toISOString();
  } catch {
    return '';
  }
};

export const formatDisplayDate = (timestamp: string, options: {
  includeTime?: boolean;
  includeTimezone?: boolean;
  dateStyle?: 'short' | 'medium' | 'long' | 'full';
  timeStyle?: 'short' | 'medium' | 'long' | 'full';
} = {}): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const {
      includeTime = true,
      includeTimezone = false,
      dateStyle = 'medium',
      timeStyle = 'short'
    } = options;

    const formatOptions: Intl.DateTimeFormatOptions = {};
    
    if (includeTime) {
      // When including time, use explicit format options (no year for cleaner UI)
      formatOptions.month = 'short';
      formatOptions.day = 'numeric';
      formatOptions.hour = 'numeric';
      formatOptions.minute = '2-digit';
      if (timeStyle === 'medium' || timeStyle === 'long' || timeStyle === 'full') {
        formatOptions.second = '2-digit';
      }
    } else {
      // When not including time, use explicit format options (no year for cleaner UI)
      formatOptions.month = 'short';
      formatOptions.day = 'numeric';
    }

    if (includeTimezone) {
      formatOptions.timeZoneName = 'short';
    }

    return date.toLocaleString(undefined, formatOptions);
  } catch {
    return '';
  }
};

export const formatRelativeTime = (timestamp: string): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return formatDisplayDate(timestamp, { includeTime: false, includeTimezone: false });
  } catch {
    return '';
  }
};

export const getCurrentUTCTimestamp = (): string => {
  return new Date().toISOString();
};

export const generateRandomId = (): string => {
  // Use crypto.randomUUID if available, fallback to secure random string
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: generate cryptographically secure random string
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Last resort fallback for environments without crypto
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const parseWorkoutDuration = (startTime: string, endTime: string | null): {
  durationMs: number;
  durationText: string;
} => {
  if (!startTime || !endTime) {
    return { durationMs: 0, durationText: 'In Progress' };
  }

  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { durationMs: 0, durationText: 'Invalid duration' };
    }

    const durationMs = end.getTime() - start.getTime();
    
    if (durationMs < 0) {
      return { durationMs: 0, durationText: 'Invalid duration' };
    }

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return { durationMs, durationText: `${hours}h ${minutes}m` };
    } else if (minutes > 0) {
      return { durationMs, durationText: `${minutes}m ${seconds}s` };
    } else {
      return { durationMs, durationText: `${seconds}s` };
    }
  } catch {
    return { durationMs: 0, durationText: 'Invalid duration' };
  }
}; 