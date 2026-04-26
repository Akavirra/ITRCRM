import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/lookup',
  '/api/auth/reset-temporary-password',
  '/api/notifications/telegram',
  '/api/notifications/teacher-daily-reminders',
  '/api/notifications/teacher-hourly-reminders',
  '/api/telegram',
  '/telegram',
  '/teacher-app',
  '/api/teacher-app',
  '/tg-app',
  '/admin-app',
  '/api/admin-app',
  '/api/tg-app',
  '/api/lesson-media',
  '/api/internal',
  '/api/public/courses',
  '/enroll',
  '/api/enroll',
  '/register-teacher',
  '/api/teacher-invites',
]

// Check if pathname starts with any of the public routes
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ----- Student portal hostname routing --------------------------------------
// Публічні шляхи для учнів (без cookie student_session):
const STUDENT_PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/student/auth/login',
  '/api/student/auth/logout',
  // PWA metadata, які Next.js авто-додає в <head> кожної сторінки.
  // Мають бути доступні без auth, інакше browser getting 302→/login при fetch manifest.
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon',
  '/favicon.ico',
]);

// Дозволені URL-перші сегменти для піддомена students.* (все інше — 404).
// Заборонено admin-шляхи (dashboard модалей, api/students, api/groups тощо).
const STUDENT_ALLOWED_PATHS = [
  '/',           // root — middleware сам редіректить на /login або /dashboard
  '/login',
  '/dashboard',
  '/groups',
  '/schedule',
  '/attendance',
  '/profile',
  '/works',
  // Phase C.2: QR-Upload — мобільна сторінка без cookie, аутент через JWT в URL.
  '/m/',
  '/api/student/',
  // Next.js internals + static
  '/_next/',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  // PWA / metadata (згенеровані Next.js з src/app/manifest.ts, icon.svg, apple-icon.tsx)
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon',
];

function isStudentHost(host: string | null): boolean {
  if (!host) return false;
  // students.itrobotics.com.ua або students.* (для preview-доменів Vercel теж)
  // Для локалу без DNS — можна виставити env STUDENT_HOST_OVERRIDE="localhost:3001" тощо
  const override = process.env.STUDENT_HOST_OVERRIDE;
  if (override && host === override) return true;
  return /^students\./i.test(host);
}

// ----- Teacher portal hostname routing --------------------------------------
const TEACHER_PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/teacher/auth/login',
  '/api/teacher/auth/logout',
]);

const TEACHER_ALLOWED_PATHS = [
  '/',
  '/login',
  '/dashboard',
  '/lessons',
  '/groups',
  '/students',
  '/profile',
  '/api/teacher/',
  // Next.js internals + static
  '/_next/',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  // PWA / metadata (auto-generated Next.js): manifest.webmanifest, icon, apple-icon
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon',
];

function isTeacherHost(host: string | null): boolean {
  if (!host) return false;
  const override = process.env.TEACHER_HOST_OVERRIDE;
  if (override && host === override) return true;
  return /^teacher\./i.test(host);
}

function isTeacherAllowedPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return TEACHER_ALLOWED_PATHS.some((p) => {
    if (p === '/') return false;
    if (p.endsWith('/')) return pathname.startsWith(p);
    return pathname === p || pathname.startsWith(p + '/');
  });
}

function isStudentAllowedPath(pathname: string): boolean {
  if (pathname === '/') return true; // root — далі middleware сам редіректить
  return STUDENT_ALLOWED_PATHS.some(p => {
    if (p === '/') return false; // '/' матчиться лише точно — обробили вище
    if (p.endsWith('/')) return pathname.startsWith(p);
    return pathname === p || pathname.startsWith(p + '/');
  });
}

function handleStudentHost(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Блокуємо спроби звернутись до внутрішнього /s/* префіксу напряму з students.*
  // (вони мали б іти через rewrite, а не прямим URL — захист від підміни)
  if (pathname.startsWith('/s/') || pathname === '/s') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Дозволені тільки певні шляхи на піддомені учнів
  if (!isStudentAllowedPath(pathname)) {
    // 404 з порожнім body — Next.js відрендерить not-found.tsx якщо є, інакше дефолт
    return new NextResponse(null, { status: 404 });
  }

  // CSRF для API (як і раніше, але тільки на student-api)
  if (MUTATION_METHODS.has(request.method) && pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (origin) {
      const host = request.headers.get('host');
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json({ error: 'CSRF перевірка не пройшла' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'CSRF перевірка не пройшла' }, { status: 403 });
      }
    }
  }

  // Auth check для НЕ-публічних шляхів
  const isPublic =
    STUDENT_PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/api/student/auth/') ||
    // Phase C.2: мобільна QR-сторінка та її API (auth через JWT в URL/header,
    // НЕ student_session cookie — телефон ніколи не логіниться).
    pathname.startsWith('/m/') ||
    pathname === '/api/student/works/direct-mobile';
  const studentCookie = request.cookies.get('student_session')?.value;

  if (!isPublic && !studentCookie) {
    // API → 401 JSON, сторінки → redirect на /login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/') {
      url.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(url);
  }

  // / → /dashboard (якщо залогінений) або /login
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = studentCookie ? '/dashboard' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // REWRITE: /<path> → /s/<path> (для UI-сторінок; API залишаємо як є)
  let response: NextResponse;
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/') && !pathname.includes('.')) {
    const url = request.nextUrl.clone();
    url.pathname = `/s${pathname}`;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }

  applyStudentSecurityHeaders(response);
  return response;
}

function handleTeacherHost(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Блокуємо прямий доступ до /t/* префіксу — внутрішній, тільки через rewrite
  if (pathname.startsWith('/t/') || pathname === '/t') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!isTeacherAllowedPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // CSRF для мутаційного API
  if (MUTATION_METHODS.has(request.method) && pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (origin) {
      const host = request.headers.get('host');
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json({ error: 'CSRF перевірка не пройшла' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'CSRF перевірка не пройшла' }, { status: 403 });
      }
    }
  }

  const isPublic =
    TEACHER_PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/teacher/auth/');
  const teacherCookie = request.cookies.get('teacher_session')?.value;

  if (!isPublic && !teacherCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/') url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = teacherCookie ? '/dashboard' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // REWRITE: /<path> → /t/<path>
  let response: NextResponse;
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/') && !pathname.includes('.')) {
    const url = request.nextUrl.clone();
    url.pathname = `/t${pathname}`;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }

  applyTeacherSecurityHeaders(response);
  return response;
}

function applyTeacherSecurityHeaders(response: NextResponse): void {
  const isDev = process.env.NODE_ENV === 'development';

  // Викладачу можна img-src з Cloudinary (фото профілю), Drive thumbnails (галерея заняття)
  // та blob:/data: для локального превʼю.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://drive.google.com https://*.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

/**
 * Жорсткіші security-заголовки для students.* піддомену.
 * Наш портал учня — один маленький React-app, який НЕ використовує сторонні скрипти,
 * iframe'и, чи media з Google Drive (це адмінське). Тому CSP тут суттєво строгіший,
 * ніж глобальний (next.config.js).
 */
function applyStudentSecurityHeaders(response: NextResponse): void {
  const isDev = process.env.NODE_ENV === 'development';

  // Дозволяємо XHR/fetch на upload-service (multipart POST для /upload/student-work).
  // UPLOAD_SERVICE_URL — серверна env var; беремо origin (схема+хост), не повний шлях.
  let uploadOrigin = '';
  try {
    if (process.env.UPLOAD_SERVICE_URL) {
      uploadOrigin = new URL(process.env.UPLOAD_SERVICE_URL).origin;
    }
  } catch {
    // ігноруємо — залишимо connect-src 'self'
  }

  const connectSrc = uploadOrigin ? `'self' ${uploadOrigin}` : "'self'";

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host')

  // ----- Student portal (students.itrobotics.com.ua) -----
  if (isStudentHost(host)) {
    const studentResponse = handleStudentHost(request);
    if (studentResponse) return studentResponse;
    return NextResponse.next();
  }

  // ----- Teacher portal (teacher.itrobotics.com.ua) -----
  if (isTeacherHost(host)) {
    const teacherResponse = handleTeacherHost(request);
    if (teacherResponse) return teacherResponse;
    return NextResponse.next();
  }

  // ----- Admin-side (все як було) ------------------------
  // Блокуємо прямий доступ до /s/* і /t/* з admin-хоста — це внутрішні префікси
  // (production only; у dev пускаємо для тестування)
  if ((pathname.startsWith('/s/') || pathname === '/s') && process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }
  if (pathname.startsWith('/s/') || pathname === '/s') {
    return NextResponse.next();
  }
  if ((pathname.startsWith('/t/') || pathname === '/t') && process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }
  if (pathname.startsWith('/t/') || pathname === '/t') {
    return NextResponse.next();
  }

  const legacyTelegramLessonMatch = pathname.match(/^\/telegram\/lesson\/([^/]+)$/)
  if (legacyTelegramLessonMatch) {
    const url = request.nextUrl.clone()
    const versionSeed = (process.env.NEXT_PUBLIC_TEACHER_APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || '1').slice(0, 12)
    if (!url.searchParams.get('v')) {
      url.searchParams.set('v', versionSeed)
    }
    url.pathname = `/teacher-app/lesson/${legacyTelegramLessonMatch[1]}`
    return NextResponse.redirect(url)
  }

  // Пропускаємо публічні маршрути
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Пропускаємо статику
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // CSRF: перевіряємо Origin для мутаційних запитів до API
  if (MUTATION_METHODS.has(request.method) && pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (origin) {
      const hostHeader = request.headers.get('host');
      try {
        const originHost = new URL(origin).host;
        if (originHost !== hostHeader) {
          return NextResponse.json({ error: 'CSRF перевірка не пройшла' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'CSRF перевірка не пройшла' }, { status: 403 });
      }
    }
  }

  // Перевіряємо наявність сесійного cookie (адмінського)
  const token = request.cookies.get('session_id')?.value

  if (pathname.startsWith('/api/') && !token) {
    return NextResponse.json({ error: 'Необхідна авторизація' }, { status: 401 })
  }

  if (pathname === '/') {
    const url = new URL(token ? '/dashboard' : '/login', request.url)
    return NextResponse.redirect(url)
  }

  if (!token) {
    const url = new URL('/login', request.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
