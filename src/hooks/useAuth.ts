import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * Signs the browser in anonymously on first visit and returns the stable user object.
 * The session persists in localStorage so the same identity survives page refreshes.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore existing session first
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user)
        setLoading(false)
      } else {
        // No session — sign in anonymously
        supabase.auth.signInAnonymously().then(({ data: d }) => {
          setUser(d.user ?? null)
          setLoading(false)
        })
      }
    })

    // Keep state in sync if session changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return { user, loading }
}
