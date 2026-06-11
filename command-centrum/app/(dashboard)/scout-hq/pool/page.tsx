'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, RotateCw, Copy, Send } from 'lucide-react'

export default function FinalPoolPage() {
  const [activeTab, setActiveTab] = useState<'incoming' | 'approved' | 'rejected' | 'archived'>('incoming')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  const [items, setItems] = useState({
    incoming: [
      {
        id: '1',
        sourceModule: 'droppz_scout',
        title: 'New Album Release',
        artists: ['Artist A', 'Artist B'],
        type: 'release',
        priority: 85,
        status: 'incoming',
      },
    ],
    approved: [
      {
        id: '2',
        sourceModule: 'feed_content_scout',
        title: 'Music News Story',
        artists: ['Artist C'],
        type: 'content',
        priority: 72,
        status: 'approved',
      },
    ],
    rejected: [],
    archived: [],
  })

  const tabItems = items[activeTab]
  const stats = {
    incoming: items.incoming.length,
    approved: items.approved.length,
    rejected: items.rejected.length,
    archived: items.archived.length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#E8E8E8]">🔗 Final Pool</h1>
        <p className="text-sm text-[#A8A8A8]">Unified data aggregation and management</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Incoming" value={stats.incoming} active={activeTab === 'incoming'} />
        <StatCard label="Approved" value={stats.approved} active={activeTab === 'approved'} />
        <StatCard label="Rejected" value={stats.rejected} active={activeTab === 'rejected'} />
        <StatCard label="Archived" value={stats.archived} active={activeTab === 'archived'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['incoming', 'approved', 'rejected', 'archived'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-[#A8A8A8] hover:text-[#D0D0D0]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-[#E8E8E8]">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Items</h2>
          <button className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.05] text-sm text-[#D0D0D0] transition-colors">
            <RotateCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {tabItems.length === 0 ? (
          <div className="text-center py-12 text-[#A8A8A8]">
            <p>No {activeTab} items</p>
          </div>
        ) : (
          tabItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full p-4 hover:bg-white/[0.04] transition-colors flex items-center justify-between"
              >
                <div className="flex-1 text-left space-y-1">
                  <p className="font-medium text-[#E8E8E8]">{item.title}</p>
                  <div className="flex gap-2 text-xs text-[#A8A8A8]">
                    <span className="capitalize">{item.sourceModule}</span>
                    <span>•</span>
                    <span>{item.artists.join(', ')}</span>
                    <span>•</span>
                    <span className="text-purple-400">Score: {item.priority}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs capitalize ${
                    item.status === 'approved' ? 'bg-green-900/30 text-[#1AEE99]' :
                    item.status === 'rejected' ? 'bg-red-900/30 text-red-300' :
                    'bg-blue-900/30 text-blue-300'
                  }`}>
                    {item.status}
                  </span>
                  {expandedId === item.id ? (
                    <ChevronUp className="h-4 w-4 text-[#A8A8A8]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#A8A8A8]" />
                  )}
                </div>
              </button>

              {expandedId === item.id && (
                <div className="px-4 py-4 bg-black/40 backdrop-blur-md border-t border-white/10 space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[#A8A8A8] block mb-1">Source Module</span>
                      <p className="text-[#E8E8E8] font-mono text-xs">{item.sourceModule}</p>
                    </div>
                    <div>
                      <span className="text-[#A8A8A8] block mb-1">Type</span>
                      <p className="text-[#E8E8E8] capitalize">{item.type}</p>
                    </div>
                    <div>
                      <span className="text-[#A8A8A8] block mb-1">Priority Score</span>
                      <p className="text-purple-400 font-mono">{item.priority}</p>
                    </div>
                    <div>
                      <span className="text-[#A8A8A8] block mb-1">Status</span>
                      <p className="text-[#E8E8E8] capitalize">{item.status}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {activeTab === 'incoming' && (
                      <>
                        <button className="flex items-center gap-1 px-3 py-2 text-xs bg-green-900/30 text-[#1AEE99] hover:bg-green-900/50 transition-colors">
                          <CheckCircle className="h-3 w-3" />
                          Approve
                        </button>
                        <button className="flex items-center gap-1 px-3 py-2 text-xs bg-red-900/30 text-red-300 hover:bg-red-900/50 transition-colors">
                          <XCircle className="h-3 w-3" />
                          Reject
                        </button>
                      </>
                    )}
                    {activeTab === 'approved' && (
                      <button className="flex items-center gap-1 px-3 py-2 text-xs bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 transition-colors">
                        <Send className="h-3 w-3" />
                        Resend
                      </button>
                    )}
                    <button className="flex items-center gap-1 px-3 py-2 text-xs bg-white/[0.05] text-[#D0D0D0] hover:bg-white/[0.08] transition-colors">
                      <Copy className="h-3 w-3" />
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${
      active
        ? 'border-purple-700 bg-purple-900/20'
        : 'border-white/10 bg-white/[0.03]'
    }`}>
      <p className="text-xs font-medium text-[#A8A8A8] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${
        active ? 'text-purple-400' : 'text-[#E8E8E8]'
      }`}>{value}</p>
    </div>
  )
}

function CheckCircle({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  )
}

function XCircle({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  )
}
