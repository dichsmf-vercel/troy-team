import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/safe-redirect'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  // Only same-origin paths are allowed; anything else falls back to the default.
  const next = safeNextPath(searchParams.get('next'), '/auth/set-password')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/auth/error`)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Supabase email invites can deliver an implicit-flow access token in the URL hash
  // (never sent to the server). The browser Supabase client consumes it on the
  // destination page, so a code-less callback still continues to `next`.
  return NextResponse.redirect(`${origin}${next}`)
}
