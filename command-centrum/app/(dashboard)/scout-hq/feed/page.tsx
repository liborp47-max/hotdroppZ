'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ExternalLink, RotateCw } from 'lucide-react'

type FeedSource = {
  label: string
  url: string
  kind: 'primary' | 'supporting'
  exactArticle?: boolean
}

type FeedItem = {
  id: string
  headline: string
  contentType: string
  category: string
  artists: string[]
  publishDate: Date
  priorityScore: number
  status: string
  language: string
  sources: FeedSource[]
}

export default function FeedScoutPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'collected' | 'rejected' | 'sources' | 'logs' | 'settings'>('collected')
  const [items] = useState<FeedItem[]>([
    {
      id: '1',
      headline: 'Drake and The Weeknd Spotted at Studio Together',
      contentType: 'drama',
      category: 'drama',
      artists: ['Drake', 'The Weeknd'],
      publishDate: new Date(Date.now() - 3600000),
      priorityScore: 78,
      status: 'approved',
      language: 'en',
      sources: [
        {
          label: 'TMZ - Drake and The Weeknd Spotted Together at Studio Session',
          url: 'https://www.tmz.com/2026/05/11/drake-the-weeknd-studio-session/',
          kind: 'primary',
          exactArticle: true,
        },
        {
          label: 'Instagram Fan Clip - Studio Arrival Video',
          url: 'https://www.instagram.com/p/DJfStudioClip01/',
          kind: 'supporting',
          exactArticle: true,
        },
      ],
    },
    {
      id: '2',
      headline: 'Kendrick Lamar Announces New Album',
      contentType: 'news',
      category: 'news',
      artists: ['Kendrick Lamar'],
      publishDate: new Date(Date.now() - 7200000),
      priorityScore: 95,
      status: 'approved',
      language: 'en',
      sources: [
        {
          label: 'Billboard - Kendrick Lamar Announces New Album',
          url: 'https://www.billboard.com/music/rb-hip-hop/kendrick-lamar-new-album-announcement-2026-1235678901/',
          kind: 'primary',
          exactArticle: true,
        },
        {
          label: 'Artist Announcement - Official Instagram Post',
          url: 'https://www.instagram.com/p/DJkKendrickAlbum02/',
          kind: 'supporting',
          exactArticle: true,
        },
      ],
    },
  ])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#E8E8E8]">⚡ Feed Content Scout</h1>
        <p className="text-sm text-[#A8A8A8]">Monitor content intelligence and trends</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['collected', 'rejected', 'sources', 'logs', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[#A8A8A8] hover:text-[#D0D0D0]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'collected' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#E8E8E8]">Collected Content</h2>
              <button className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.05] text-sm text-[#D0D0D0] transition-colors">
                <RotateCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full p-4 hover:bg-white/[0.04] transition-colors flex items-center justify-between"
                >
                  <div className="flex-1 text-left space-y-1">
                    <p className="font-medium text-[#E8E8E8]">{item.headline}</p>
                    <div className="flex gap-2 text-xs text-[#A8A8A8]">
                      <span>{item.artists.join(', ')}</span>
                      <span>•</span>
                      <span className="capitalize">{item.category}</span>
                      <span>•</span>
                      <span className="uppercase">{item.language}</span>
                      <span>•</span>
                      <span>{item.sources[0]?.label.split(' - ')[0] ?? 'Unknown source'}</span>
                      <span>•</span>
                      <span className="text-blue-400">Score: {item.priorityScore}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 text-xs bg-blue-900/30 text-blue-300 capitalize">
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
                  <div className="px-4 py-3 bg-black/40 backdrop-blur-md border-t border-white/10 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[#A8A8A8]">Content Type:</span>
                        <p className="text-[#E8E8E8] capitalize">{item.contentType}</p>
                      </div>
                      <div>
                        <span className="text-[#A8A8A8]">Publish Date:</span>
                        <p className="text-[#E8E8E8]">{item.publishDate.toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-[#A8A8A8]">Language:</span>
                        <p className="text-[#E8E8E8] uppercase">{item.language}</p>
                      </div>
                      <div>
                        <span className="text-[#A8A8A8]">Priority Score:</span>
                        <p className="text-blue-400 font-mono">{item.priorityScore}</p>
                      </div>
                      <div>
                        <span className="text-[#A8A8A8]">Status:</span>
                        <p className="text-[#E8E8E8] capitalize">{item.status}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-[#A8A8A8]">Exact Sources:</span>
                      <div className="mt-2 space-y-2">
                        {item.sources.map((source) => (
                          <div key={`${item.id}-${source.label}-${source.url}`} className="flex items-center justify-between border border-white/10 bg-white/[0.025] px-3 py-2">
                            <div>
                              <p className="text-[#E8E8E8] text-sm">{source.label}</p>
                              <p className="text-[11px] uppercase tracking-wider text-[#A8A8A8]">
                                {source.kind}
                                {source.exactArticle ? ' • exact article' : ''}
                              </p>
                              <p className="text-[11px] text-[#6E6E6E] break-all mt-1">{source.url}</p>
                            </div>
                            <Link
                              href={source.url}
                              target="_blank"
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                              Open Article
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button className="px-3 py-1 text-xs bg-green-900/30 text-[#1AEE99] hover:bg-green-900/50 transition-colors">
                        Approve
                      </button>
                      <button className="px-3 py-1 text-xs bg-red-900/30 text-red-300 hover:bg-red-900/50 transition-colors">
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] backdrop-blur-md border-b border-white/10">
                  <tr>
                    <th className="px-4 py-2 text-left text-[#A8A8A8]">Source</th>
                    <th className="px-4 py-2 text-left text-[#A8A8A8]">Status</th>
                    <th className="px-4 py-2 text-left text-[#A8A8A8]">Last Checked</th>
                    <th className="px-4 py-2 text-right text-[#A8A8A8]">Articles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {[
                    { name: 'Pitchfork RSS', status: 'active', lastChecked: '2m ago', items: 125 },
                    { name: 'Twitter Music', status: 'active', lastChecked: '1m ago', items: 450 },
                  ].map((source) => (
                    <tr key={source.name} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 text-[#E8E8E8]">{source.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-green-900/30 text-[#1AEE99]">
                          {source.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#A8A8A8]">{source.lastChecked}</td>
                      <td className="px-4 py-3 text-right text-[#E8E8E8]">{source.items}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rejected' && (
          <div className="text-center py-8 text-[#A8A8A8]">
            <p>No rejected items</p>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-black p-4 font-mono text-xs text-[#A8A8A8] space-y-1 max-h-96 overflow-y-auto">
            <div>[2026-05-11 14:29:00] Starting Feed monitor...</div>
            <div>[2026-05-11 14:29:15] Checking RSS feeds...</div>
            <div>[2026-05-11 14:30:00] Found 24 new articles</div>
            <div className="text-green-600">[2026-05-11 14:30:30] ✓ Processing complete</div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-2xl">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#D0D0D0] block mb-3">
                  Category Ratios
                </label>
                <div className="space-y-2">
                  {[
                    { name: 'News', value: 30 },
                    { name: 'Drama', value: 25 },
                    { name: 'Trends', value: 25 },
                    { name: 'Fashion', value: 10 },
                    { name: 'Events', value: 10 },
                  ].map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <span className="text-sm text-[#D0D0D0]">{cat.name}</span>
                      <input
                        type="number"
                        defaultValue={cat.value}
                        className="w-20 px-2 py-1 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-4 px-4 py-2 bg-blue-900/30 text-blue-300 text-sm font-medium hover:bg-blue-900/50 transition-colors">
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
