'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

/**
 * AuthProvider component that monitors authentication state
 * and automatically refreshes the session when needed
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Set up auto token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Session token refreshed')
      }

      if (event === 'SIGNED_OUT') {
        // Redirect to login if on a protected route
        const publicRoutes = ['/', '/auth/login', '/auth/sign-up', '/auth/check-email']
        if (!publicRoutes.some(route => pathname?.startsWith(route))) {
          router.push('/auth/login')
        }
      }

      if (event === 'SIGNED_IN') {
        // Refresh the page to update server-side session
        router.refresh()
      }

      // Token expired
      if (event === 'USER_DELETED') {
        router.push('/auth/login')
      }
    })

    // Initial session check
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Session check error:', error)
      }

      if (!session) {
        const publicRoutes = ['/', '/auth/login', '/auth/sign-up', '/auth/check-email']
        if (!publicRoutes.some(route => pathname?.startsWith(route))) {
          router.push('/auth/login')
        }
      }
    }

    checkSession()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, pathname])

  if (!mounted) {
    return <>{children}</>
  }

  return <>{children}</>
}
