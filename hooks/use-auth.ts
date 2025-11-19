import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)

      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null)
        router.refresh()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        router.push('/auth/login')
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully')
        setUser(session?.user ?? null)
      } else if (event === 'USER_UPDATED') {
        setUser(session?.user ?? null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  return { user, loading, isAuthenticated: !!user }
}
