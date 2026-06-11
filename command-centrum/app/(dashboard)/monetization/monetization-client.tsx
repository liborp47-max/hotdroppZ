'use client'

import { useState, useTransition } from 'react'
import {
  DollarSign, Plus, ToggleLeft, ToggleRight,
  Pencil, Check, X, Calendar, Building2,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { toggleCampaign, toggleAdSlot, createCampaign, createAdSlot } from '@/lib/actions/monetization'
import type { AdCampaign, AdSlot } from '@/lib/types'

interface Props {
  initialCampaigns: AdCampaign[]
  initialSlots: (AdSlot & { campaign?: Pick<AdCampaign, 'id' | 'name' | 'client'> | null })[]
}

const SLOT_TYPES = ['banner', 'native', 'interstitial'] as const
const POSITIONS = ['feed-top', 'feed-inline', 'article-top', 'article-bottom', 'sidebar', 'breaking-bar']

function BudgetBar({ budget, spent = 0 }: { budget: number | null; spent?: number }) {
  if (!budget) return <span className="text-[#A8A8A8] text-xs">No budget</span>
  const pct = Math.min((spent / budget) * 100, 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[#A8A8A8]">${spent.toLocaleString()} spent</span>
        <span className="text-[#A8A8A8]">${budget.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05]">
        <div
          className={cn('h-full rounded-full', pct > 80 ? 'bg-red-500' : 'bg-venom-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function NewCampaignRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [budget, setBudget] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) return
    startTransition(async () => {
      await createCampaign({ name, client, budget: budget ? Number(budget) : null, start_date: startDate || null, end_date: endDate || null })
      onDone()
    })
  }

  return (
    <tr className="bg-venom-500/5 border-b border-white/10">
      <td className="px-4 py-2.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name"
          className="w-full bg-white/[0.05] text-[#E8E8E8] text-sm px-2 py-1 border border-white/15 focus:outline-none focus:border-venom-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="Client"
          className="w-full bg-white/[0.05] text-[#E8E8E8] text-sm px-2 py-1 border border-white/15 focus:outline-none focus:border-venom-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="0"
          type="number"
          className="w-full bg-white/[0.05] text-[#E8E8E8] text-sm px-2 py-1 border border-white/15 focus:outline-none focus:border-venom-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          type="date"
          className="bg-white/[0.05] text-[#E8E8E8] text-sm px-2 py-1 border border-white/15 focus:outline-none focus:border-venom-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          type="date"
          className="bg-white/[0.05] text-[#E8E8E8] text-sm px-2 py-1 border border-white/15 focus:outline-none focus:border-venom-500"
        />
      </td>
      <td className="px-4 py-2.5" />
      <td className="px-4 py-2.5">
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={pending || !name.trim()}
            className="flex items-center gap-1 px-2 py-1 bg-venom-500 text-white text-xs hover:bg-venom-600 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Save
          </button>
          <button onClick={onDone} className="p-1 hover:bg-white/[0.08] text-[#A8A8A8]">
            <X className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function NewSlotRow({ campaigns, onDone }: { campaigns: AdCampaign[]; onDone: () => void }) {
  const [position, setPosition] = useState('')
  const [type, setType] = useState<typeof SLOT_TYPES[number]>('banner')
  const [campaignId, setCampaignId] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!position.trim()) return
    startTransition(async () => {
      await createAdSlot({ position, type, campaign_id: campaignId || null })
      onDone()
    })
  }

  return (
    <tr className="bg-venom-500/5 border-b border-white/10">
      <td className="px-4 py-2.5">
        <input
          autoFocus
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          list="positions"
          placeholder="e.g. feed-inline"
          className="w-full bg-white/[0.05] text-[#E8E8E8] text-sm px-2 py-1 border border-white/15 focus:outline-none focus:border-venom-500"
        />
        <datalist id="positions">
          {POSITIONS.map((p) => <option key={p} value={p} />)}
        </datalist>
      </td>
      <td className="px-4 py-2.5">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof SLOT_TYPES[number])}
          className="bg-white/[0.05] text-[#E8E8E8] text-sm px-2 py-1 border border-white/15 focus:outline-none"
        >
          {SLOT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="bg-white/[0.05] text-[#E8E8E8] text-sm px-2 py-1 border border-white/15 focus:outline-none"
        >
          <option value="">— none —</option>
          {campaigns.filter((c) => c.active).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5" />
      <td className="px-4 py-2.5">
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={pending || !position.trim()}
            className="flex items-center gap-1 px-2 py-1 bg-venom-500 text-white text-xs hover:bg-venom-600 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Save
          </button>
          <button onClick={onDone} className="p-1 hover:bg-white/[0.08] text-[#A8A8A8]">
            <X className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function MonetizationClient({ initialCampaigns, initialSlots }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [slots, setSlots] = useState(initialSlots)
  const [addingCampaign, setAddingCampaign] = useState(false)
  const [addingSlot, setAddingSlot] = useState(false)
  const [, startTransition] = useTransition()

  function handleToggleCampaign(id: string, current: boolean) {
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, active: !current } : c))
    startTransition(async () => {
      await toggleCampaign(id, !current)
    })
  }

  function handleToggleSlot(id: string, current: boolean) {
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, active: !current } : s))
    startTransition(async () => {
      await toggleAdSlot(id, !current)
    })
  }

  const activeCampaigns = campaigns.filter((c) => c.active).length
  const activeSlots = slots.filter((s) => s.active).length

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#E8E8E8] flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-venom-500" />
          Monetization
        </h1>
        <p className="text-sm text-[#A8A8A8] mt-1">
          {activeCampaigns} active campaign{activeCampaigns !== 1 ? 's' : ''} · {activeSlots} active slot{activeSlots !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Campaigns */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#D0D0D0] uppercase tracking-wider">Campaigns</h2>
          <button
            onClick={() => setAddingCampaign(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] text-[#D0D0D0] text-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Campaign
          </button>
        </div>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] backdrop-blur-md">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Budget</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Start</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">End</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {addingCampaign && (
                <NewCampaignRow onDone={() => { setAddingCampaign(false); window.location.reload() }} />
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#E8E8E8]">{c.name}</td>
                  <td className="px-4 py-3 text-[#A8A8A8] flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-[#6E6E6E]" />
                    {c.client ?? '—'}
                  </td>
                  <td className="px-4 py-3 min-w-[160px]">
                    <BudgetBar budget={c.budget} />
                  </td>
                  <td className="px-4 py-3 text-[#A8A8A8] text-xs">
                    {c.start_date ? (
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(c.start_date)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#A8A8A8] text-xs">
                    {c.end_date ? formatDate(c.end_date) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      c.active ? 'bg-green-500/15 text-[#00E085]' : 'bg-white/[0.05] text-[#A8A8A8]'
                    )}>
                      {c.active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleCampaign(c.id, c.active)}
                      className="p-1.5 hover:bg-white/[0.08] text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors"
                      title={c.active ? 'Pause campaign' : 'Activate campaign'}
                    >
                      {c.active
                        ? <ToggleRight className="h-4 w-4 text-green-500" />
                        : <ToggleLeft className="h-4 w-4" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && !addingCampaign && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#6E6E6E] text-sm">
                    No campaigns yet. Create your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ad Slots */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#D0D0D0] uppercase tracking-wider">Ad Slots</h2>
          <button
            onClick={() => setAddingSlot(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] text-[#D0D0D0] text-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Slot
          </button>
        </div>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] backdrop-blur-md">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Position</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Campaign</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {addingSlot && (
                <NewSlotRow
                  campaigns={campaigns}
                  onDone={() => { setAddingSlot(false); window.location.reload() }}
                />
              )}
              {slots.map((slot) => (
                <tr key={slot.id} className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-xs bg-white/[0.05] text-venom-400 px-2 py-0.5 rounded">
                      {slot.position}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-white/[0.05] text-[#A8A8A8]">
                      {slot.type ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#A8A8A8] text-sm">
                    {slot.campaign
                      ? <span className="text-[#D0D0D0]">{slot.campaign.name}</span>
                      : <span className="text-[#6E6E6E] italic">Unassigned</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      slot.active ? 'bg-green-500/15 text-[#00E085]' : 'bg-white/[0.05] text-[#A8A8A8]'
                    )}>
                      {slot.active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleSlot(slot.id, slot.active)}
                      className="p-1.5 hover:bg-white/[0.08] text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors"
                    >
                      {slot.active
                        ? <ToggleRight className="h-4 w-4 text-green-500" />
                        : <ToggleLeft className="h-4 w-4" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
              {slots.length === 0 && !addingSlot && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#6E6E6E] text-sm">
                    No ad slots configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
