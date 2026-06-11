'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Account settings → Change password.
// Security model: passwords are NEVER stored by this app. We delegate to Supabase
// Auth, which stores only a bcrypt hash. Changing the password re-authenticates
// with the current one first (so an unattended session can't silently change it),
// then calls supabase.auth.updateUser({ password }).
export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    if (!email) {
      setError('No active session. Please sign in again.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // 1) Verify the current password by re-authenticating.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      })
      if (reauthError) {
        setError('Current password is incorrect.')
        return
      }

      // 2) Set the new password (Supabase stores only the bcrypt hash).
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md p-6">
      <div className="mb-6 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-[#00E085]" />
        <h1 className="text-sm font-semibold uppercase tracking-wider text-[#E8E8E8]">
          Change password
        </h1>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6">
        <p className="mb-5 text-xs text-[#A8A8A8]">
          Signed in as <span className="text-[#E8E8E8]">{email ?? '…'}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              placeholder="••••••••"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="next">New password</Label>
            <Input
              id="next"
              type="password"
              placeholder="At least 8 characters"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-800/50 bg-red-950/50 px-3 py-2">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-md border border-[#00E085]/40 bg-[#00E085]/10 px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-[#00E085]" />
              <p className="text-sm text-[#00E085]">Password updated successfully.</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-venom-500 hover:bg-venom-600 text-white font-medium"
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-[#404040]">
        Stored securely by Supabase Auth (bcrypt) — never by this app
      </p>
    </div>
  )
}
