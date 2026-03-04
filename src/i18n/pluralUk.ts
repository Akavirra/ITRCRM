/**
 * Ukrainian pluralization helper
 * 
 * Ukrainian has three plural forms:
 * - one (1, 21, 31, 41, ...): 1 учень, 21 учень
 * - few (2-4, 22-24, 32-34, ...): 2 учні, 3 учні, 22 учні
 * - many (5-20, 25-30, 35-40, ...): 5 учнів, 11 учнів, 25 учнів
 * 
 * @param n - The number to determine plural form for
 * @param one - Form for 1, 21, 31, etc.
 * @param few - Form for 2-4, 22-24, etc.
 * @param many - Form for 5-20, 25-30, etc.
 * @returns The correct plural form
 * 
 * @example
 * pluralUk(1, 'учень', 'учні', 'учнів') // 'учень'
 * pluralUk(2, 'учень', 'учні', 'учнів') // 'учні'
 * pluralUk(5, 'учень', 'учні', 'учнів') // 'учнів'
 * pluralUk(21, 'учень', 'учні', 'учнів') // 'учень'
 * pluralUk(22, 'учень', 'учні', 'учнів') // 'учні'
 * pluralUk(25, 'учень', 'учні', 'учнів') // 'учнів'
 */
export function pluralUk(n: number, one: string, few: string, many: string): string {
  // Handle negative numbers
  const absN = Math.abs(n);
  
  // Special case: numbers ending in 11-14 use 'many' form
  // This is because 11-14 are exceptions in Ukrainian
  const lastTwoDigits = absN % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return many;
  }
  
  // Get the last digit
  const lastDigit = absN % 10;
  
  // 1 uses 'one' form
  if (lastDigit === 1) {
    return one;
  }
  
  // 2-4 use 'few' form
  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }
  
  // 0, 5-9 use 'many' form
  return many;
}

/**
 * Format a number with the correct plural form
 * @param n - The number
 * @param one - Form for 1
 * @param few - Form for 2-4
 * @param many - Form for 5+
 * @returns Formatted string like "5 учнів"
 */
export function formatPluralUk(n: number, one: string, few: string, many: string): string {
  return `${n} ${pluralUk(n, one, few, many)}`;
}

/**
 * Common Ukrainian plural forms for convenience
 */
export const ukPlurals = {
  student: {
    one: 'учень',
    few: 'учні',
    many: 'учнів',
  },
  group: {
    one: 'група',
    few: 'групи',
    many: 'груп',
  },
  lesson: {
    one: 'заняття',
    few: 'заняття',
    many: 'занять',
  },
  debtor: {
    one: 'боржник',
    few: 'боржники',
    many: 'боржників',
  },
  course: {
    one: 'курс',
    few: 'курси',
    many: 'курсів',
  },
  user: {
    one: 'користувач',
    few: 'користувачі',
    many: 'користувачів',
  },
  hour: {
    one: 'година',
    few: 'години',
    many: 'годин',
  },
  minute: {
    one: 'хвилина',
    few: 'хвилини',
    many: 'хвилин',
  },
  month: {
    one: 'місяць',
    few: 'місяці',
    many: 'місяців',
  },
} as const;
