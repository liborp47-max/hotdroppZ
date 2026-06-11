'use client'

import { useState } from 'react'
import { Search, Download, RotateCw } from 'lucide-react'

export default function StoragePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    artist: '',
    title: '',
    category: 'all',
    source: 'all',
    dateFrom: '',
    dateTo: '',
  })

  const storageStats = [
    { label: 'Raw Data', items: 5000, size: '125.5 MB' },
    { label: 'Processed Data', items: 4800, size: '120.2 MB' },
    { label: 'Filtered Out', items: 200, size: '5.3 MB' },
    { label: 'Final Output', items: 1050, size: '45.8 MB' },
    { label: 'Archived', items: 3750, size: '78.2 MB' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#E8E8E8]">💾 Storage Explorer</h1>
        <p className="text-sm text-[#A8A8A8]">Search, filter, and export data across all storage layers</p>
      </div>

      {/* Storage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {storageStats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-medium text-[#A8A8A8] uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-lg font-bold text-[#E8E8E8] mb-1">{stat.items.toLocaleString()}</p>
            <p className="text-xs text-[#A8A8A8]">{stat.size}</p>
          </div>
        ))}
      </div>

      {/* Search Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[#E8E8E8]">Search & Filter</h2>
        
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">Artist</label>
              <input
                type="text"
                placeholder="Search artists..."
                value={filters.artist}
                onChange={(e) => setFilters({ ...filters, artist: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm placeholder-[#404040]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">Title</label>
              <input
                type="text"
                placeholder="Search titles..."
                value={filters.title}
                onChange={(e) => setFilters({ ...filters, title: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm placeholder-[#404040]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
              >
                <option value="all">All Categories</option>
                <option value="music">Music</option>
                <option value="news">News</option>
                <option value="drama">Drama</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">Source</label>
              <select
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
              >
                <option value="all">All Sources</option>
                <option value="droppz">DroppZ Scout</option>
                <option value="feed">Feed Scout</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 text-sm font-medium transition-colors">
              <Search className="h-4 w-4" />
              Search
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] text-[#D0D0D0] hover:bg-white/[0.08] text-sm font-medium transition-colors">
              <RotateCw className="h-4 w-4" />
              Reset
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-900/30 text-[#1AEE99] hover:bg-green-900/50 text-sm font-medium transition-colors ml-auto">
              <Download className="h-4 w-4" />
              Export JSON
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-900/30 text-[#1AEE99] hover:bg-green-900/50 text-sm font-medium transition-colors">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        <p className="text-sm text-[#A8A8A8]">Found <span className="text-[#E8E8E8] font-mono">0</span> results</p>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-[#A8A8A8]">No results. Try adjusting your search filters.</p>
        </div>
      </div>
    </div>
  )
}
