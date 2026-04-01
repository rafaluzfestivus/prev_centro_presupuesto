import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh session — IMPORTANT: never remove this call
    const { data: { user } } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Routes that don't require authentication
    const isPublicRoute =
        pathname.startsWith('/login') ||
        pathname.startsWith('/proposal') ||          // client-facing proposal pages
        pathname.startsWith('/api/webhooks') ||      // Evolution API webhook (no user auth)
        pathname.startsWith('/api/wa') ||            // Evolution API status/import
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico'

    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('next', pathname)
        return NextResponse.redirect(url)
    }

    // Redirect already-authenticated users away from login
    if (user && pathname === '/login') {
        const next = request.nextUrl.searchParams.get('next') || '/dashboard'
        const url = request.nextUrl.clone()
        url.pathname = next
        url.searchParams.delete('next')
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all routes except static files
         */
        '/((?!_next/static|_next/image|favicon.ico|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
