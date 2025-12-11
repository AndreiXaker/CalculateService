import { NextResponse, NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value || '';

  if (!accessToken) {
    return NextResponse.redirect(new URL('/',request.url))
}
  return NextResponse.next();
  }

  export const config = {
  matcher: ['/main/:path*', '/add-product/:path*', '/main/new'],
}