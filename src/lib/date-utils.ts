/**
 * Utility functions for date and time formatting with Kyiv timezone support
 * 
 * IMPORTANT: SQLite stores dates as text without timezone information.
 * The dates stored via CURRENT_TIMESTAMP are in UTC format (e.g., "2026-02-18 23:29:52").
 * 
 * When JavaScript parses such dates without 'Z' suffix, it treats them as LOCAL time.
 * We need to explicitly treat them as UTC by appending 'Z' if not present.
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Timezone for all date/time display in the application
 */
export const KYIV_TIMEZONE = 'Europe/Kyiv';

/**
 * Locale for date/time formatting
 */
export const UKRAINIAN_LOCALE = 'uk-UA';

/**
 * Convert a database date string to a proper UTC Date object
 * SQLite stores dates as "YYYY-MM-DD HH:mm:ss" without timezone.
 * Neon PostgreSQL may return dates with timezone (e.g., "2026-02-26 22:00:00+01").
 * This function handles both cases properly.
 * 
 * @param dateInput - Date string from database
 * @returns Date object in UTC
 */
function parseDatabaseDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) return new Date();
  
  // If dateInput is already a Date object, return it
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  // If dateInput is a string, parse it
  const dateStr = String(dateInput);
  
  // If already has timezone info (ISO format with Z), parse directly as UTC
  if (dateStr.includes('Z')) {
    return new Date(dateStr);
  }
  
  // Check if has space-separated datetime with timezone offset (Neon PostgreSQL format)
  // e.g., "2026-02-26 22:00:00+01" or "2026-02-26 22:00:00+01:00"
  // Remove the timezone offset and treat as local time (Kyiv timezone)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}(:\d{2})?$/.test(dateStr)) {
    // Remove timezone offset to get local time
    const dateWithoutTz = dateStr.replace(/[+-]\d{2}(:\d{2})?$/, '');
    // Parse as date in UTC, then convert to Kyiv timezone to get the correct time
    // Then convert back to UTC for storage
    const utcDate = new Date(dateWithoutTz + 'Z');
    return utcDate;
  }
  
  // SQLite format: "YYYY-MM-DD HH:mm:ss" - treat as UTC by appending 'Z'
  // Replace space with T for ISO format and add Z for UTC
  const isoString = dateStr.replace(' ', 'T') + 'Z';
  return new Date(isoString);
}

/**
 * Options for formatting date in Kyiv timezone
 */
const kyivDateOptions: Intl.DateTimeFormatOptions = {
  timeZone: KYIV_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

/**
 * Options for formatting datetime in Kyiv timezone
 */
const kyivDateTimeOptions: Intl.DateTimeFormatOptions = {
  timeZone: KYIV_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

/**
 * Options for formatting short date in Kyiv timezone
 */
const kyivShortDateOptions: Intl.DateTimeFormatOptions = {
  timeZone: KYIV_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
};

/**
 * Options for formatting date with short month name
 */
const kyivShortMonthDateOptions: Intl.DateTimeFormatOptions = {
  timeZone: KYIV_TIMEZONE,
  day: 'numeric',
  month: 'short',
};

/**
 * Options for formatting time only
 */
const kyivTimeOptions: Intl.DateTimeFormatOptions = {
  timeZone: KYIV_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
};

/**
 * Format a date string (UTC) to Kyiv timezone date string
 * @param dateStr - Date string from database (stored as UTC)
 * @returns Formatted date string in dd.MM.yyyy format
 */
export function formatDateKyiv(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = parseDatabaseDate(dateStr);
  return date.toLocaleDateString(UKRAINIAN_LOCALE, kyivDateOptions);
}

/**
 * Format a date string (UTC) to Kyiv timezone with short format (dd.MM.yy)
 * @param dateStr - Date string from database (stored as UTC)
 * @returns Formatted date string in dd.MM.yy format
 */
export function formatShortDateKyiv(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = parseDatabaseDate(dateStr);
  return date.toLocaleDateString(UKRAINIAN_LOCALE, kyivShortDateOptions);
}

/**
 * Format a datetime string (UTC) to Kyiv timezone datetime string
 * @param dateStr - Datetime string from database (stored as UTC)
 * @returns Formatted datetime string in dd.MM.yyyy, HH:mm format
 */
export function formatDateTimeKyiv(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = parseDatabaseDate(dateStr);
  return date.toLocaleString(UKRAINIAN_LOCALE, kyivDateTimeOptions);
}

/**
 * Format a date string with short month name (e.g., "18 лют")
 * @param dateStr - Date string from database (stored as UTC)
 * @returns Formatted date string with short month name
 */
export function formatDateShortMonthKyiv(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = parseDatabaseDate(dateStr);
  return date.toLocaleDateString(UKRAINIAN_LOCALE, kyivShortMonthDateOptions);
}

/**
 * Format time only from a datetime string
 * @param dateStr - Datetime string from database (stored as UTC)
 * @returns Formatted time string in HH:mm format
 */
export function formatTimeKyiv(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = parseDatabaseDate(dateStr);
  return date.toLocaleTimeString(UKRAINIAN_LOCALE, kyivTimeOptions);
}

/**
 * Get current date/time in Kyiv timezone as Date object
 * @returns Current datetime adjusted to Kyiv timezone
 */
export function nowKyiv(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: KYIV_TIMEZONE }));
}

/**
 * Create a formatter function for Kyiv timezone dates
 * Useful for creating reusable formatters with custom options
 * @param options - Custom Intl.DateTimeFormatOptions
 * @returns Formatter function
 */
export function createKyivFormatter(options: Intl.DateTimeFormatOptions): (dateStr: string | null | undefined) => string {
  const formatter = new Intl.DateTimeFormat(UKRAINIAN_LOCALE, {
    timeZone: KYIV_TIMEZONE,
    ...options,
  });
  
  return (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    return formatter.format(parseDatabaseDate(dateStr));
  };
}
