'use client'

import { useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'global' | 'droppz' | 'feed' | 'pool'>('global')
  const [hasChanges, setHasChanges] = useState(false)

  const [globalSettings, setGlobalSettings] = useState({
    scoutEnabled: true,
    refreshIntervalMinutes: 5,
    maxItemsPerBatch: 100,
    logLevel: 'debug',
  })

  const [droppzSettings, setDroppzSettings] = useState({
    freshnessHours: 24,
    monitoredPlatforms: ['spotify', 'apple_music'],
    scoreWeights: {
      recency: 0.4,
      popularity: 0.35,
      artistTier: 0.25,
    },
  })

  const [feedSettings, setFeedSettings] = useState({
    categoryRatios: {
      news: 0.3,
      drama: 0.25,
      trends: 0.25,
      fashion: 0.1,
      events: 0.1,
    },
    scoreWeights: {
      engagement: 0.4,
      novelty: 0.4,
      artistRelevance: 0.2,
    },
  })

  const [poolSettings, setPoolSettings] = useState({
    minPriorityScore: 40,
    requireAssets: true,
  })

  const handleSave = () => {
    setHasChanges(false)
    // API call would go here
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#E8E8E8]">⚙️ Settings</h1>
        <p className="text-sm text-[#A8A8A8]">Configure SCOUT HQ behavior and parameters</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['global', 'droppz', 'feed', 'pool'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-[#A8A8A8] hover:text-[#D0D0D0]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-2xl space-y-6">
        {activeTab === 'global' && (
          <div className="space-y-4 border border-white/10 bg-white/[0.03] p-6">
            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={globalSettings.scoutEnabled}
                  onChange={(e) => {
                    setGlobalSettings({ ...globalSettings, scoutEnabled: e.target.checked })
                    setHasChanges(true)
                  }}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm font-medium text-[#D0D0D0]">Scout Enabled</span>
              </label>
            </div>

            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">
                Refresh Interval (minutes)
              </label>
              <input
                type="number"
                value={globalSettings.refreshIntervalMinutes}
                onChange={(e) => {
                  setGlobalSettings({ ...globalSettings, refreshIntervalMinutes: parseInt(e.target.value) })
                  setHasChanges(true)
                }}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">
                Max Items Per Batch
              </label>
              <input
                type="number"
                value={globalSettings.maxItemsPerBatch}
                onChange={(e) => {
                  setGlobalSettings({ ...globalSettings, maxItemsPerBatch: parseInt(e.target.value) })
                  setHasChanges(true)
                }}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">
                Log Level
              </label>
              <select
                value={globalSettings.logLevel}
                onChange={(e) => {
                  setGlobalSettings({ ...globalSettings, logLevel: e.target.value })
                  setHasChanges(true)
                }}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'droppz' && (
          <div className="space-y-4 border border-white/10 bg-white/[0.03] p-6">
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">
                Freshness Hours
              </label>
              <input
                type="number"
                value={droppzSettings.freshnessHours}
                onChange={(e) => {
                  setDroppzSettings({ ...droppzSettings, freshnessHours: parseInt(e.target.value) })
                  setHasChanges(true)
                }}
                className="w-full px-3 py-2 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-3">
                Monitored Platforms
              </label>
              <div className="space-y-2">
                {['spotify', 'apple_music', 'bandcamp'].map((platform) => (
                  <label key={platform} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={droppzSettings.monitoredPlatforms.includes(platform)}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...droppzSettings.monitoredPlatforms, platform]
                          : droppzSettings.monitoredPlatforms.filter(p => p !== platform)
                        setDroppzSettings({ ...droppzSettings, monitoredPlatforms: updated })
                        setHasChanges(true)
                      }}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-sm text-[#D0D0D0] capitalize">{platform.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-3">
                Score Weights
              </label>
              <div className="space-y-2">
                {Object.entries(droppzSettings.scoreWeights).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-[#D0D0D0] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={value}
                        onChange={(e) => {
                          setDroppzSettings({
                            ...droppzSettings,
                            scoreWeights: {
                              ...droppzSettings.scoreWeights,
                              [key]: parseFloat(e.target.value),
                            },
                          })
                          setHasChanges(true)
                        }}
                        className="w-32"
                      />
                      <span className="text-sm text-[#A8A8A8] font-mono w-10 text-right">{value.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'feed' && (
          <div className="space-y-4 border border-white/10 bg-white/[0.03] p-6">
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-3">
                Category Ratios
              </label>
              <div className="space-y-2">
                {Object.entries(feedSettings.categoryRatios).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-[#D0D0D0] capitalize">{key}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={value}
                        onChange={(e) => {
                          setFeedSettings({
                            ...feedSettings,
                            categoryRatios: {
                              ...feedSettings.categoryRatios,
                              [key]: parseFloat(e.target.value),
                            },
                          })
                          setHasChanges(true)
                        }}
                        className="w-32"
                      />
                      <span className="text-sm text-[#A8A8A8] font-mono w-10 text-right">{(value * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pool' && (
          <div className="space-y-4 border border-white/10 bg-white/[0.03] p-6">
            <div>
              <label className="text-sm font-medium text-[#D0D0D0] block mb-2">
                Min Priority Score
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={poolSettings.minPriorityScore}
                  onChange={(e) => {
                    setPoolSettings({ ...poolSettings, minPriorityScore: parseInt(e.target.value) })
                    setHasChanges(true)
                  }}
                  className="flex-1"
                />
                <span className="text-sm text-[#A8A8A8] font-mono w-12 text-right">{poolSettings.minPriorityScore}</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={poolSettings.requireAssets}
                  onChange={(e) => {
                    setPoolSettings({ ...poolSettings, requireAssets: e.target.checked })
                    setHasChanges(true)
                  }}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm font-medium text-[#D0D0D0]">Require Assets</span>
              </label>
            </div>
          </div>
        )}

        {/* Save/Reset Buttons */}
        {hasChanges && (
          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-900/30 text-[#1AEE99] hover:bg-green-900/50 text-sm font-medium transition-colors"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
            <button
              onClick={() => setHasChanges(false)}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] text-[#D0D0D0] hover:bg-white/[0.08] text-sm font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
