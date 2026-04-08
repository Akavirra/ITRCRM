import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/lookup',
  '/api/auth/reset-temporary-password',
  '/api/notifications/telegram',
  '/api/telegram',
  '/telegram',
  '/teacher-app',
  '/api/teacher-app',
  '/tg-app',
  '/admin-app',
  '/api/admin-app',
  '/api/tg-app',
  '/api/internal',
  '/enroll',
  '/api/enroll',
]

// Check if pathname starts with any of the public routes
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  // Перевіряємо наявність сесійного cookie
  // Назва cookie: session_id (з src/app/api/auth/login/route.ts)
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
