'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeOptions {
  table: string
  schema?: string
  filter?: string
  onInsert?: (payload: Record<string, unknown>) => void
  onUpdate?: (payload: Record<string, unknown>) => void
  onDelete?: (payload: Record<string, unknown>) => void
}

export function useRealtime({
  table,
  schema = 'public',
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Keep refs in sync without triggering reconnects
  const insertRef = useRef(onInsert)
  const updateRef = useRef(onUpdate)
  const deleteRef = useRef(onDelete)
  insertRef.current = onInsert
  updateRef.current = onUpdate
  deleteRef.current = onDelete

  useEffect(() => {
    const supabase = createClient()
    const channelName = `realtime:${schema}:${table}${filter ? `:${filter}` : ''}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema, table, filter },
        (payload) => {
          insertRef.current?.(payload.new as Record<string, unknown>)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema, table, filter },
        (payload) => {
          updateRef.current?.(payload.new as Record<string, unknown>)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema, table, filter },
        (payload) => {
          deleteRef.current?.(payload.old as Record<string, unknown>)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, schema, filter]) // callbacks excluded — accessed via refs
}
