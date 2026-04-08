export const TG_APP_ROLE_KEY = 'tg_app_role';
export const TG_APP_ROLE_COOKIE = 'tg_app_role';
export const TG_APP_ROLES_KEY = 'tg_app_roles';

export type TgAppRole = 'admin' | 'teacher';

export function readSavedTgAppRole(): TgAppRole | null {
  if (typeof document === 'undefined') {
    return null;
  }

  try {
    const localRole = localStorage.getItem(TG_APP_ROLE_KEY);
    if (localRole === 'admin' || localRole === 'teacher') {
      return localRole;
    }
  } catch {}

  const cookieMatch = document.cookie.match(/(?:^|;\s*)tg_app_role=([^;]+)/);
  if (!cookieMatch) {
    return null;
  }

  const cookieRole = decodeURIComponent(cookieMatch[1]);
  return cookieRole === 'admin' || cookieRole === 'teacher' ? cookieRole : null;
}

export function saveTgAppRole(role: TgAppRole): void {
  if (typeof document === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(TG_APP_ROLE_KEY, role);
  } catch {}

  document.cookie = `${TG_APP_ROLE_COOKIE}=${encodeURIComponent(role)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
