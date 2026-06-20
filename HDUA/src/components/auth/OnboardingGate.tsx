import { useEffect } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { getProfile } from '@/api/user'
import { useAuth } from '@/stores/auth'

/**
 * First-run gate (P1-004). When an authed user's profile has not completed
 * onboarding, redirect them into the flow. Renders nothing. Mounted once at the
 * root. Guards against a redirect loop by checking the active route segment, and
 * the onboarding flow seeds onboarding_completed=true into the cache before it
 * navigates away, so this never bounces the user back.
 */
export function OnboardingGate() {
  const router = useRouter()
  const segments = useSegments()
  const status = useAuth((s) => s.status)

  const { data: profile, isFetched } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled: status === 'authed',
  })

  useEffect(() => {
    if (status !== 'authed' || !isFetched) return
    const onOnboarding = segments[0] === 'onboarding'
    if (profile && profile.onboarding_completed === false && !onOnboarding) {
      router.replace('/onboarding')
    }
  }, [status, isFetched, profile, segments, router])

  return null
}
