import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/notifications/telegram',
  '/api/telegram',
  '/telegram',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Пропускаємо публічні маршрути
  if (PUBLIC_ROUTES.some(route => pathname === route)) {
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

  // Перевіряємо наявність сесійного cookie
  // Назва cookie: session_id (з src/app/api/auth/login/route.ts)
  const token = request.cookies.get('session_id')?.value

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
