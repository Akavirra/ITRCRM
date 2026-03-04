// Translation helper with simple interpolation support
import { uk } from './uk';
import { pluralUk } from './pluralUk';

type TranslationParams = Record<string, string | number>;

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as string | undefined;
}

/**
 * Replace {param} placeholders with actual values
 */
function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }, template);
}

/**
 * Translation function
 * @param key - Dot notation key (e.g., 'nav.dashboard', 'toasts.created')
 * @param params - Optional parameters for interpolation (e.g., { name: 'John' })
 * @returns Translated string with interpolated values
 */
export function t(key: string, params?: TranslationParams): string {
  const value = getNestedValue(uk as unknown as Record<string, unknown>, key);
  
  if (value === undefined) {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }
  
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }
  
  return interpolate(value, params);
}

/**
 * Get a translation that requires pluralization
 * @param key - Base key for plural forms (e.g., 'plural.student')
 * @param count - Number to determine plural form
 * @returns The correct plural form
 */
export function tPlural(key: string, count: number): string {
  const pluralObj = getNestedValue(uk as unknown as Record<string, unknown>, key);
  
  if (!pluralObj || typeof pluralObj !== 'object') {
    console.warn(`Plural translation key not found: ${key}`);
    return key;
  }
  
  const forms = pluralObj as { one: string; few: string; many: string };
  return pluralUk(count, forms.one, forms.few, forms.many);
}

export { uk };
export type { TranslationParams };
