/** Маленький хелпер для умовних класів — без зовнішніх залежностей. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
