import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // ── Auth guards ────────────────────────────────────────────────────────────
  const protectedPrefixes = ['/dashboard', '/intake', '/admin', '/profile', '/session', '/program', '/progress']
  const isProtected = protectedPrefixes.some((p) => path.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (user && path.startsWith('/auth/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // ── Forced password change ─────────────────────────────────────────────────
  // If the user is logged in but hasn't set their own password yet,
  // redirect them to /auth/set-password?forced=1 from any protected route.
  // Skip this check if they're already on the set-password page.
  if (user && isProtected && !path.startsWith('/auth/set-password')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('password_change_required')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.password_change_required) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/set-password'
      url.searchParams.set('forced', '1')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
