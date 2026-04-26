export function getTeacherAppVersionSeed(): string {
  return (process.env.NEXT_PUBLIC_TEACHER_APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || '1').slice(0, 12);
}

export function ensureTeacherAppVersion(search: URLSearchParams | ReadonlyURLSearchParamsLike | null | undefined): string {
  const nextParams = new URLSearchParams(search?.toString() ?? '');
  if (!nextParams.get('v')) {
    nextParams.set('v', getTeacherAppVersionSeed());
  }
  return nextParams.toString();
}

interface ReadonlyURLSearchParamsLike {
  toString(): string;
}
