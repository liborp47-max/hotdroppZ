'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      // Allow a bare username (e.g. "admin") — map it to the canonical email
      // domain. Supabase Auth is email-based, so "admin" → "admin@hotdroppz.com".
      const identifier = email.includes('@') ? email.trim() : `${email.trim()}@hotdroppz.com`
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      router.push('/hd-central')
      router.refresh()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 bg-venom-500 mb-4 shadow-lg shadow-venom-500/20">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#E8E8E8]">HotDroppZ</h1>
          <p className="text-sm text-[#A8A8A8] mt-1">Control Centrum</p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6">
          <h2 className="text-base font-semibold text-[#E8E8E8] mb-5">Sign in to HDCC</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email or username</Label>
              <Input
                id="email"
                type="text"
                placeholder="admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-950/50 border border-red-800/50 px-3 py-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-venom-500 hover:bg-venom-600 text-white font-medium"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6E6E6E] mt-6">
          Internal tool — authorized personnel only
        </p>
      </div>
    </div>
  )
}
