'use client'

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  Type,
  Image,
  Tag,
  Video,
  AlignLeft,
  Layout,
  CheckCircle2,
  Music,
  Newspaper,
  Globe,
  Flame,
  Lightbulb,
  Shirt,
  Smartphone,
  Move,
  Maximize2,
  Grid3X3,
  Layers,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ContentCategory =
  | 'droppz'
  | 'music_news'
  | 'global_news'
  | 'drama_beef'
  | 'intel'
  | 'fashion'

type AreaType =
  | 'headline'
  | 'subheadline'
  | 'body'
  | 'image'
  | 'tag'
  | 'video'
  | 'caption'
  | 'cta'
  | 'logo'
  | 'overlay'

type AreaSection = 'background' | 'text' | 'media' | 'meta'

type TemplateArea = {
  id: string
  name: string
  type: AreaType
  section: AreaSection
  instructions: string
  gridRow: number
  gridCol: number
  rowSpan: number
  colSpan: number
  required: boolean
  zIndex?: number
}

type CategoryTemplate = {
  category: ContentCategory
  name: string
  description: string
  cols: number
  rows: number
  areas: TemplateArea[]
}

type DragState = {
  areaId: string
  startX: number
  startY: number
  startRow: number
  startCol: number
  startRowSpan: number
  startColSpan: number
  mode: 'move' | 'resize'
}

const DEFAULT_COLS = 24
const DEFAULT_ROWS = 48

const CATEGORY_META: Record<
  ContentCategory,
  { label: string; color: string; icon: React.ElementType; accent: string }
> = {
  droppz: { label: 'DroppZ', color: 'text-venom-400', icon: Music, accent: 'border-venom-500/40 bg-venom-500/10' },
  music_news: { label: 'Music News', color: 'text-blue-400', icon: Newspaper, accent: 'border-blue-500/40 bg-blue-500/10' },
  global_news: { label: 'Global News', color: 'text-cyan-400', icon: Globe, accent: 'border-cyan-500/40 bg-cyan-500/10' },
  drama_beef: { label: 'Drama / Beef', color: 'text-red-400', icon: Flame, accent: 'border-red-500/40 bg-red-500/10' },
  intel: { label: 'Intel', color: 'text-amber-400', icon: Lightbulb, accent: 'border-amber-500/40 bg-amber-500/10' },
  fashion: { label: 'Fashion', color: 'text-pink-400', icon: Shirt, accent: 'border-pink-500/40 bg-pink-500/10' },
}

const AREA_TYPES: { key: AreaType; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'headline', label: 'Headline', icon: Type, color: 'text-[#E8E8E8]' },
  { key: 'subheadline', label: 'Subheadline', icon: AlignLeft, color: 'text-[#D0D0D0]' },
  { key: 'body', label: 'Body', icon: AlignLeft, color: 'text-[#A8A8A8]' },
  { key: 'image', label: 'Image', icon: Image, color: 'text-purple-400' },
  { key: 'video', label: 'Video', icon: Video, color: 'text-blue-400' },
  { key: 'tag', label: 'Tag', icon: Tag, color: 'text-[#00E085]' },
  { key: 'caption', label: 'Caption', icon: AlignLeft, color: 'text-[#A8A8A8]' },
  { key: 'cta', label: 'CTA', icon: Layout, color: 'text-orange-400' },
  { key: 'logo', label: 'Logo', icon: Layers, color: 'text-cyan-400' },
  { key: 'overlay', label: 'Overlay', icon: Layers, color: 'text-fuchsia-400' },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function genId() {
  return Math.random().toString(36).slice(2, 8)
}

function buildDefaultAreas(category: ContentCategory): TemplateArea[] {
  return [
    {
      id: genId(),
      name: 'Background Image',
      type: 'image',
      section: 'background',
      instructions: `Main image for ${CATEGORY_META[category].label}. Creator imports source visual here.`,
      gridRow: 1,
      gridCol: 1,
      rowSpan: DEFAULT_ROWS,
      colSpan: DEFAULT_COLS,
      required: true,
      zIndex: 1,
    },
    {
      id: genId(),
      name: 'Main Headline',
      type: 'headline',
      section: 'text',
      instructions: 'Primary text layer over image. Keep short and strong.',
      gridRow: 32,
      gridCol: 3,
      rowSpan: 5,
      colSpan: 20,
      required: true,
      zIndex: 2,
    },
    {
      id: genId(),
      name: 'Subheadline',
      type: 'subheadline',
      section: 'text',
      instructions: 'Secondary line under headline.',
      gridRow: 38,
      gridCol: 3,
      rowSpan: 4,
      colSpan: 20,
      required: false,
      zIndex: 3,
    },
  ]
}

function makeDefaultTemplate(category: ContentCategory): CategoryTemplate {
  return {
    category,
    name: `${CATEGORY_META[category].label} Template`,
    description: `Simple adjustable post design template for ${CATEGORY_META[category].label}`,
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    areas: buildDefaultAreas(category),
  }
}

function normalizeTemplate(template: CategoryTemplate, category: ContentCategory): CategoryTemplate {
  const cols = clamp(template.cols || DEFAULT_COLS, 12, 60)
  const rows = clamp(template.rows || DEFAULT_ROWS, 20, 120)

  return {
    ...template,
    category,
    cols,
    rows,
    areas: (template.areas || []).map((area, idx) => ({
      ...area,
      section: area.section || 'text',
      zIndex: area.zIndex ?? idx + 1,
      gridCol: clamp(area.gridCol || 1, 1, cols),
      gridRow: clamp(area.gridRow || 1, 1, rows),
      colSpan: clamp(area.colSpan || 1, 1, cols),
      rowSpan: clamp(area.rowSpan || 1, 1, rows),
    })),
  }
}

export function TemplateManager() {
  const [activeCategory, setActiveCategory] = useState<ContentCategory>('droppz')
  const [templates, setTemplates] = useState<Record<ContentCategory, CategoryTemplate>>(() => {
    const defaults: Record<ContentCategory, CategoryTemplate> = {
      droppz: makeDefaultTemplate('droppz'),
      music_news: makeDefaultTemplate('music_news'),
      global_news: makeDefaultTemplate('global_news'),
      drama_beef: makeDefaultTemplate('drama_beef'),
      intel: makeDefaultTemplate('intel'),
      fashion: makeDefaultTemplate('fashion'),
    }

    const stored = typeof window !== 'undefined' ? localStorage.getItem('hd_templates') : null
    if (!stored) return defaults

    try {
      const parsed = JSON.parse(stored) as Partial<Record<ContentCategory, CategoryTemplate>>
      const merged: Record<ContentCategory, CategoryTemplate> = { ...defaults }

      ;(Object.keys(defaults) as ContentCategory[]).forEach(category => {
        if (parsed[category]) {
          merged[category] = normalizeTemplate(parsed[category] as CategoryTemplate, category)
        }
      })

      return merged
    } catch {
      return defaults
    }
  })

  const [editingArea, setEditingArea] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [dragState, setDragState] = useState<DragState | null>(null)

  const currentTemplate = templates[activeCategory]

  const phoneWidth = 320
  const phoneHeight = 620
  const canvasPadding = 12
  const canvasWidth = phoneWidth - canvasPadding * 2
  const canvasHeight = phoneHeight - canvasPadding * 2
  const cellW = canvasWidth / currentTemplate.cols
  const cellH = canvasHeight / currentTemplate.rows

  const saveTemplates = (updated: Record<ContentCategory, CategoryTemplate>) => {
    setTemplates(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('hd_templates', JSON.stringify(updated))
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const updateCurrentTemplate = (updatedTemplate: CategoryTemplate) => {
    saveTemplates({ ...templates, [activeCategory]: updatedTemplate })
  }

  const updateArea = (id: string, patch: Partial<TemplateArea>) => {
    updateCurrentTemplate({
      ...currentTemplate,
      areas: currentTemplate.areas.map(area => (area.id === id ? { ...area, ...patch } : area)),
    })
  }

  const removeArea = (id: string) => {
    updateCurrentTemplate({
      ...currentTemplate,
      areas: currentTemplate.areas.filter(area => area.id !== id),
    })
    if (editingArea === id) setEditingArea(null)
  }

  const removeSection = (section: AreaSection) => {
    updateCurrentTemplate({
      ...currentTemplate,
      areas: currentTemplate.areas.filter(area => area.section !== section),
    })
    if (editingArea) {
      const stillExists = currentTemplate.areas.some(a => a.id === editingArea && a.section !== section)
      if (!stillExists) setEditingArea(null)
    }
  }

  const addSingleLayer = () => {
    const nextZ = Math.max(1, ...currentTemplate.areas.map(a => a.zIndex ?? 1)) + 1
    const newArea: TemplateArea = {
      id: genId(),
      name: 'New Layer',
      type: 'body',
      section: 'text',
      instructions: '',
      gridRow: 4,
      gridCol: 4,
      rowSpan: 5,
      colSpan: 12,
      required: false,
      zIndex: nextZ,
    }

    updateCurrentTemplate({ ...currentTemplate, areas: [...currentTemplate.areas, newArea] })
    setEditingArea(newArea.id)
  }

  const addBackgroundSection = () => {
    const nextZ = Math.max(1, ...currentTemplate.areas.map(a => a.zIndex ?? 1)) + 1
    const layers: TemplateArea[] = [
      {
        id: genId(),
        name: 'Background Image',
        type: 'image',
        section: 'background',
        instructions: 'Base image layer. Full-screen.',
        gridRow: 1,
        gridCol: 1,
        rowSpan: currentTemplate.rows,
        colSpan: currentTemplate.cols,
        required: true,
        zIndex: nextZ,
      },
      {
        id: genId(),
        name: 'Readability Overlay',
        type: 'overlay',
        section: 'background',
        instructions: 'Optional gradient overlay to improve text contrast.',
        gridRow: Math.floor(currentTemplate.rows * 0.55),
        gridCol: 1,
        rowSpan: Math.floor(currentTemplate.rows * 0.45),
        colSpan: currentTemplate.cols,
        required: false,
        zIndex: nextZ + 1,
      },
    ]

    updateCurrentTemplate({
      ...currentTemplate,
      areas: [...currentTemplate.areas, ...layers],
    })
    setEditingArea(layers[0].id)
  }

  const addTextSection = () => {
    const nextZ = Math.max(1, ...currentTemplate.areas.map(a => a.zIndex ?? 1)) + 1
    const layers: TemplateArea[] = [
      {
        id: genId(),
        name: 'Headline',
        type: 'headline',
        section: 'text',
        instructions: 'Main title. Max 8 words.',
        gridRow: 32,
        gridCol: 3,
        rowSpan: 5,
        colSpan: currentTemplate.cols - 4,
        required: true,
        zIndex: nextZ,
      },
      {
        id: genId(),
        name: 'Subheadline',
        type: 'subheadline',
        section: 'text',
        instructions: 'Context line under headline.',
        gridRow: 38,
        gridCol: 3,
        rowSpan: 4,
        colSpan: currentTemplate.cols - 4,
        required: false,
        zIndex: nextZ + 1,
      },
    ]

    updateCurrentTemplate({
      ...currentTemplate,
      areas: [...currentTemplate.areas, ...layers],
    })
    setEditingArea(layers[0].id)
  }

  const addMetaSection = () => {
    const nextZ = Math.max(1, ...currentTemplate.areas.map(a => a.zIndex ?? 1)) + 1
    const layers: TemplateArea[] = [
      {
        id: genId(),
        name: 'Tag',
        type: 'tag',
        section: 'meta',
        instructions: 'Category or keyword tag.',
        gridRow: 4,
        gridCol: 3,
        rowSpan: 3,
        colSpan: 8,
        required: false,
        zIndex: nextZ,
      },
      {
        id: genId(),
        name: 'CTA',
        type: 'cta',
        section: 'meta',
        instructions: 'Short call to action.',
        gridRow: currentTemplate.rows - 6,
        gridCol: 3,
        rowSpan: 3,
        colSpan: 10,
        required: false,
        zIndex: nextZ + 1,
      },
    ]

    updateCurrentTemplate({
      ...currentTemplate,
      areas: [...currentTemplate.areas, ...layers],
    })
    setEditingArea(layers[0].id)
  }

  const bringToFront = (id: string) => {
    const nextZ = Math.max(1, ...currentTemplate.areas.map(a => a.zIndex ?? 1)) + 1
    updateArea(id, { zIndex: nextZ })
  }

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const selected = currentTemplate.areas.find(a => a.id === id)
    if (!selected) return
    const selectedZ = selected.zIndex ?? 1

    const sortedByZ = [...currentTemplate.areas].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1))
    const index = sortedByZ.findIndex(a => a.id === id)
    if (index < 0) return

    const swapIndex = direction === 'up' ? index + 1 : index - 1
    if (swapIndex < 0 || swapIndex >= sortedByZ.length) return

    const swap = sortedByZ[swapIndex]
    const swapZ = swap.zIndex ?? 1

    updateCurrentTemplate({
      ...currentTemplate,
      areas: currentTemplate.areas.map(area => {
        if (area.id === selected.id) return { ...area, zIndex: swapZ }
        if (area.id === swap.id) return { ...area, zIndex: selectedZ }
        return area
      }),
    })
  }

  const onAreaPointerDown = (event: ReactPointerEvent<HTMLDivElement>, area: TemplateArea) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-resize-handle="true"]')) return

    event.preventDefault()
    bringToFront(area.id)
    setEditingArea(area.id)
    setDragState({
      areaId: area.id,
      startX: event.clientX,
      startY: event.clientY,
      startRow: area.gridRow,
      startCol: area.gridCol,
      startRowSpan: area.rowSpan,
      startColSpan: area.colSpan,
      mode: 'move',
    })
  }

  const onResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, area: TemplateArea) => {
    event.preventDefault()
    event.stopPropagation()
    bringToFront(area.id)
    setEditingArea(area.id)
    setDragState({
      areaId: area.id,
      startX: event.clientX,
      startY: event.clientY,
      startRow: area.gridRow,
      startCol: area.gridCol,
      startRowSpan: area.rowSpan,
      startColSpan: area.colSpan,
      mode: 'resize',
    })
  }

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState) return

    const area = currentTemplate.areas.find(a => a.id === dragState.areaId)
    if (!area) return

    const dx = event.clientX - dragState.startX
    const dy = event.clientY - dragState.startY
    const deltaCols = snapToGrid ? Math.round(dx / cellW) : Math.trunc(dx / cellW)
    const deltaRows = snapToGrid ? Math.round(dy / cellH) : Math.trunc(dy / cellH)

    if (dragState.mode === 'move') {
      const maxCol = Math.max(1, currentTemplate.cols - area.colSpan + 1)
      const maxRow = Math.max(1, currentTemplate.rows - area.rowSpan + 1)
      updateArea(area.id, {
        gridCol: clamp(dragState.startCol + deltaCols, 1, maxCol),
        gridRow: clamp(dragState.startRow + deltaRows, 1, maxRow),
      })
      return
    }

    const maxColSpan = Math.max(1, currentTemplate.cols - area.gridCol + 1)
    const maxRowSpan = Math.max(1, currentTemplate.rows - area.gridRow + 1)
    updateArea(area.id, {
      colSpan: clamp(dragState.startColSpan + deltaCols, 1, maxColSpan),
      rowSpan: clamp(dragState.startRowSpan + deltaRows, 1, maxRowSpan),
    })
  }

  const onCanvasPointerEnd = () => {
    if (!dragState) return
    setDragState(null)
  }

  const sortedAreas = useMemo(
    () => [...currentTemplate.areas].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1)),
    [currentTemplate.areas]
  )

  const editingAreaData = currentTemplate.areas.find(area => area.id === editingArea)

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#E8E8E8]">Template Studio</h1>
          <p className="text-[#A8A8A8] text-sm mt-1">Simple adjustable UI for factory post design.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-[#00E085] font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          <button
            onClick={() => saveTemplates(templates)}
            className="flex items-center gap-2 px-4 py-2 border border-white/15 bg-white/[0.03] backdrop-blur-md text-sm text-[#D0D0D0] hover:border-white/15 hover:text-[#E8E8E8] transition-all"
          >
            <Save className="h-3.5 w-3.5" />
            Save Template
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(Object.entries(CATEGORY_META) as [ContentCategory, (typeof CATEGORY_META)[ContentCategory]][]).map(([key, currentMeta]) => {
          const Icon = currentMeta.icon
          const active = activeCategory === key
          return (
            <button
              key={key}
              onClick={() => {
                setActiveCategory(key)
                setEditingArea(null)
              }}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 border text-sm font-medium transition-all',
                active
                  ? `${currentMeta.accent} ${currentMeta.color} border-opacity-60`
                  : 'border-white/15 bg-white/[0.03] text-[#A8A8A8] hover:text-[#D0D0D0] hover:border-white/15'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', active ? currentMeta.color : 'text-[#6E6E6E]')} />
              {currentMeta.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#A8A8A8]">Phone Layout Canvas</h2>
            <div className="flex items-center gap-3 text-xs text-[#A8A8A8]">
              <span>{currentTemplate.cols} cols x {currentTemplate.rows} rows</span>
              <span className="text-[#6E6E6E]">({currentTemplate.cols * currentTemplate.rows} squares)</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={event => setSnapToGrid(event.target.checked)}
                  className="accent-blue-500"
                />
                Snap
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={addBackgroundSection} className="px-3 py-2 border border-white/15 bg-white/[0.03] backdrop-blur-md text-xs text-[#D0D0D0] hover:border-white/15">Add Background Section</button>
            <button onClick={addTextSection} className="px-3 py-2 border border-white/15 bg-white/[0.03] backdrop-blur-md text-xs text-[#D0D0D0] hover:border-white/15">Add Text Section</button>
            <button onClick={addMetaSection} className="px-3 py-2 border border-white/15 bg-white/[0.03] backdrop-blur-md text-xs text-[#D0D0D0] hover:border-white/15">Add Meta Section</button>
            <button onClick={addSingleLayer} className="px-3 py-2 border border-dashed border-white/15 text-xs text-[#A8A8A8] hover:border-white/20 hover:text-[#D0D0D0]">Add Single Layer</button>
            {editingAreaData && (
              <>
                <button
                  onClick={() => removeArea(editingAreaData.id)}
                  className="px-3 py-2 border border-red-700/60 bg-red-900/20 text-xs text-red-300 hover:border-red-600"
                >
                  Delete Selected Layer
                </button>
                <button
                  onClick={() => removeSection(editingAreaData.section)}
                  className="px-3 py-2 border border-orange-700/60 bg-orange-900/20 text-xs text-orange-300 hover:border-orange-600"
                >
                  Delete Selected Section
                </button>
              </>
            )}
          </div>

          <div className="rounded-[26px] border border-white/15 bg-gradient-to-b from-black/80 to-black p-3 w-fit mx-auto shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
            <div className="w-[320px] h-[620px] rounded-[20px] border border-white/10 bg-black overflow-hidden relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-1.5 rounded-full bg-white/[0.05]" />

              <div
                className="absolute inset-3 border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(0,224,133,0.12),transparent_35%),radial-gradient(circle_at_90%_10%,rgba(59,130,246,0.12),transparent_35%),linear-gradient(to_bottom,rgba(24,24,27,0.95),rgba(9,9,11,0.97))] overflow-hidden"
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerEnd}
                onPointerCancel={onCanvasPointerEnd}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(63,63,70,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(63,63,70,0.22) 1px, transparent 1px)',
                    backgroundSize: `${cellW}px ${cellH}px`,
                  }}
                />

                {sortedAreas.map(area => {
                  const left = (area.gridCol - 1) * cellW
                  const top = (area.gridRow - 1) * cellH
                  const width = area.colSpan * cellW
                  const height = area.rowSpan * cellH
                  const typeMeta = AREA_TYPES.find(t => t.key === area.type)
                  const AreaIcon = typeMeta?.icon ?? Type
                  const isEditing = editingArea === area.id

                  return (
                    <div
                      key={area.id}
                      onPointerDown={event => onAreaPointerDown(event, area)}
                      onClick={() => setEditingArea(isEditing ? null : area.id)}
                      className={cn(
                        'absolute border px-1.5 py-1 cursor-move select-none transition-all group',
                        isEditing
                          ? 'border-amber-400/80 bg-amber-500/15 ring-1 ring-amber-400/40'
                          : 'border-white/15 bg-white/[0.03] backdrop-blur-md hover:border-white/20'
                      )}
                      style={{ left, top, width, height, zIndex: area.zIndex ?? 1 }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <AreaIcon className={cn('h-2.5 w-2.5 shrink-0', typeMeta?.color ?? 'text-[#A8A8A8]')} />
                          <span className="text-[9px] font-semibold text-[#E8E8E8] truncate">{area.name}</span>
                        </div>
                        <Move className="h-2.5 w-2.5 text-[#A8A8A8] shrink-0 opacity-60" />
                      </div>

                      {area.required && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />}

                      <button
                        data-resize-handle="true"
                        onPointerDown={event => onResizePointerDown(event, area)}
                        className="absolute -right-1 -bottom-1 h-4 w-4 border border-blue-500/50 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 flex items-center justify-center"
                        title="Resize"
                      >
                        <Maximize2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E6E6E]">
            <Grid3X3 className="h-3.5 w-3.5" />
            <span>Cols:</span>
            <input
              type="number"
              min={12}
              max={60}
              value={currentTemplate.cols}
              onChange={event =>
                updateCurrentTemplate({
                  ...currentTemplate,
                  cols: Math.max(12, Math.min(60, Number(event.target.value))),
                })
              }
              className="w-14 border border-white/15 bg-white/[0.03] backdrop-blur-md px-2 py-1 text-[#E8E8E8] text-center text-xs"
            />
            <span>Rows:</span>
            <input
              type="number"
              min={20}
              max={120}
              value={currentTemplate.rows}
              onChange={event =>
                updateCurrentTemplate({
                  ...currentTemplate,
                  rows: Math.max(20, Math.min(120, Number(event.target.value))),
                })
              }
              className="w-14 border border-white/15 bg-white/[0.03] backdrop-blur-md px-2 py-1 text-[#E8E8E8] text-center text-xs"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#A8A8A8]">Layer Inspector</h2>

          {!editingAreaData ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-8 flex flex-col items-center justify-center text-center min-h-[220px]">
              <Layout className="h-8 w-8 text-[#404040] mb-3" />
              <p className="text-sm text-[#6E6E6E]">Select layer on canvas to edit.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/15 bg-white/[0.03] backdrop-blur-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#E8E8E8]">Editing: {editingAreaData.name}</span>
                <button onClick={() => setEditingArea(null)} className="text-xs text-[#6E6E6E] hover:text-[#A8A8A8]">close</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">Name</label>
                  <input
                    value={editingAreaData.name}
                    onChange={event => updateArea(editingAreaData.id, { name: event.target.value })}
                    className="w-full border border-white/15 bg-black px-2 py-1.5 text-xs text-[#E8E8E8]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">Type</label>
                  <select
                    value={editingAreaData.type}
                    onChange={event => updateArea(editingAreaData.id, { type: event.target.value as AreaType })}
                    className="w-full border border-white/15 bg-black px-2 py-1.5 text-xs text-[#E8E8E8]"
                  >
                    {AREA_TYPES.map(type => (
                      <option key={type.key} value={type.key}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">Section</label>
                <select
                  value={editingAreaData.section}
                  onChange={event => updateArea(editingAreaData.id, { section: event.target.value as AreaSection })}
                  className="w-full border border-white/15 bg-black px-2 py-1.5 text-xs text-[#E8E8E8]"
                >
                  <option value="background">Background</option>
                  <option value="text">Text</option>
                  <option value="media">Media</option>
                  <option value="meta">Meta</option>
                </select>
              </div>

              <textarea
                value={editingAreaData.instructions}
                onChange={event => updateArea(editingAreaData.id, { instructions: event.target.value })}
                rows={4}
                placeholder="What should factory fill into this layer"
                className="w-full border border-white/15 bg-black px-2 py-1.5 text-xs text-[#E8E8E8] placeholder-[#404040] resize-none"
              />

              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'gridRow', label: 'Row', min: 1, max: currentTemplate.rows },
                  { key: 'gridCol', label: 'Col', min: 1, max: currentTemplate.cols },
                  { key: 'rowSpan', label: 'H', min: 1, max: currentTemplate.rows },
                  { key: 'colSpan', label: 'W', min: 1, max: currentTemplate.cols },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">{field.label}</label>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={
                        field.key === 'gridRow'
                          ? editingAreaData.gridRow
                          : field.key === 'gridCol'
                            ? editingAreaData.gridCol
                            : field.key === 'rowSpan'
                              ? editingAreaData.rowSpan
                              : editingAreaData.colSpan
                      }
                      onChange={event =>
                        updateArea(editingAreaData.id, {
                          [field.key]: clamp(Number(event.target.value), field.min, field.max),
                        } as Partial<TemplateArea>)
                      }
                      className="w-full border border-white/15 bg-black px-1.5 py-1 text-xs text-[#E8E8E8] text-center"
                    />
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-[#A8A8A8]">
                <input
                  type="checkbox"
                  checked={editingAreaData.required}
                  onChange={event => updateArea(editingAreaData.id, { required: event.target.checked })}
                  className="accent-red-500"
                />
                Required layer
              </label>
            </div>
          )}

          <div className="space-y-1">
            <h3 className="text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-2">Layers ({currentTemplate.areas.length})</h3>
            {[...currentTemplate.areas]
              .sort((a, b) => (b.zIndex ?? 1) - (a.zIndex ?? 1))
              .map(area => {
                const typeMeta = AREA_TYPES.find(type => type.key === area.type)
                const AreaIcon = typeMeta?.icon ?? Type
                const isEditing = editingArea === area.id

                return (
                  <div
                    key={area.id}
                    onClick={() => setEditingArea(isEditing ? null : area.id)}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2 border cursor-pointer transition-all group',
                      isEditing
                        ? 'border-amber-500/40 bg-amber-500/5 text-[#E8E8E8]'
                        : 'border-white/10 hover:border-white/15 text-[#A8A8A8] hover:text-[#D0D0D0]'
                    )}
                  >
                    <AreaIcon className={cn('h-3.5 w-3.5 shrink-0', typeMeta?.color ?? 'text-[#6E6E6E]')} />
                    <span className="text-xs font-medium flex-1 truncate">{area.name}</span>
                    <span className="text-[10px] text-[#6E6E6E]">{area.section}</span>
                    <button
                      onClick={event => {
                        event.stopPropagation()
                        moveLayer(area.id, 'up')
                      }}
                      className="p-0.5 text-[#404040] hover:text-[#D0D0D0]"
                      title="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={event => {
                        event.stopPropagation()
                        moveLayer(area.id, 'down')
                      }}
                      className="p-0.5 text-[#404040] hover:text-[#D0D0D0]"
                      title="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      onClick={event => {
                        event.stopPropagation()
                        removeArea(area.id)
                      }}
                      className="p-0.5 text-[#404040] hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {isEditing ? <ChevronDown className="h-3.5 w-3.5 text-[#6E6E6E]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#6E6E6E] opacity-0 group-hover:opacity-100" />}
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
