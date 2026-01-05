import { parse, isValid, format } from 'date-fns';

// Common date formats in Indian bank emails
// IMPORTANT: Order matters! More specific formats first, then ambiguous ones
// 2-digit year formats (yy) should come AFTER 4-digit year formats (yyyy)
// But dd-MM-yy must come BEFORE yyyy-MM-dd to avoid misparse
const DATE_FORMATS = [
  'dd-MMM-yyyy', // 05-Jan-2025
  'dd-MMM-yy', // 05-Jan-25
  'dd/MM/yyyy', // 05/01/2025
  'dd-MM-yyyy', // 05-01-2025
  'dd/MM/yy', // 05/01/25
  'dd-MM-yy', // 05-01-25 (MUST be before yyyy-MM-dd)
  'yyyy-MM-dd', // 2025-01-05
  'MMM dd, yyyy', // Jan 05, 2025
  'dd MMM yyyy', // 05 Jan 2025
  'dd MMM yy', // 05 Jan 25
];

// Parse date string to Date object
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Try parsing with each format
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(cleaned, fmt, new Date());
    if (isValid(parsed)) {
      const year = parsed.getFullYear();
      // Fix 2-digit year interpretation
      // date-fns can parse "25" as year 0025, 1925, or 2025 depending on format
      // If year is unreasonably old (before 2000), assume it's 2000+
      if (year < 100) {
        parsed.setFullYear(2000 + year);
      } else if (year >= 1900 && year < 2000) {
        // date-fns might interpret "25" as 1925
        parsed.setFullYear(year + 100);
      } else if (year < 1900) {
        // Very old year, likely misparse - add 2000
        parsed.setFullYear(year + 2000);
      }
      return parsed;
    }
  }

  // Try native Date parsing as fallback
  const nativeDate = new Date(cleaned);
  if (isValid(nativeDate)) {
    return nativeDate;
  }

  return null;
}

// Extract date from text
export function extractDate(text: string): Date | null {
  // Common date patterns
  const patterns = [
    // 05-Jan-25 or 05-Jan-2025
    /(\d{1,2}[-/]\w{3}[-/]\d{2,4})/i,
    // 05/01/2025 or 05-01-2025
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
    // 2025-01-05
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
    // Jan 05, 2025
    /(\w{3}\s+\d{1,2},?\s+\d{4})/i,
    // 05 Jan 2025
    /(\d{1,2}\s+\w{3}\s+\d{2,4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseDate(match[1]);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

// Format date for display
export function formatDate(date: Date, formatStr = 'dd MMM yyyy'): string {
  return format(date, formatStr);
}

// Format date with time
export function formatDateTime(date: Date): string {
  return format(date, 'dd MMM yyyy, hh:mm a');
}

// Get relative time string
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
